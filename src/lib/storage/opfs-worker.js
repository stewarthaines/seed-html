/**
 * OPFS Worker Script
 *
 * Handles OPFS sync access handle operations in a Web Worker.
 * Used primarily on Safari where sync access handles work better in workers.
 *
 * NOTE: This file MUST remain JavaScript (not TypeScript) because it gets
 * injected as a worker blob URL to support sync access handles in Safari.
 * Claude/agents should NOT convert this file to TypeScript.
 */

let opfsRoot = null;

async function getOPFSRoot() {
  if (!opfsRoot) {
    opfsRoot = await navigator.storage.getDirectory();
  }
  return opfsRoot;
}

async function ensureWorkspaceDirectory(workspaceId) {
  const root = await getOPFSRoot();
  const workspacesDir = await root.getDirectoryHandle('workspaces', { create: true });
  return await workspacesDir.getDirectoryHandle(workspaceId, { create: true });
}

async function ensureDirectoryPath(baseHandle, path) {
  const pathParts = path.split('/').filter(part => part.length > 0);
  let currentHandle = baseHandle;

  for (const part of pathParts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
  }

  return currentHandle;
}

async function getFileHandle(workspaceId, path, create = false) {
  const workspaceHandle = await ensureWorkspaceDirectory(workspaceId);

  const pathParts = path.split('/');
  const fileName = pathParts.pop();
  const dirPath = pathParts.join('/');

  let targetDir = workspaceHandle;
  if (dirPath) {
    targetDir = await ensureDirectoryPath(workspaceHandle, dirPath);
  }

  return await targetDir.getFileHandle(fileName, { create });
}

async function createWorkspace(data) {
  try {
    await ensureWorkspaceDirectory(data.workspaceId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteWorkspace(data) {
  try {
    const root = await getOPFSRoot();
    const workspacesDir = await root.getDirectoryHandle('workspaces');
    await workspacesDir.removeEntry(data.workspaceId, { recursive: true });
    return { success: true };
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return { success: true }; // Already deleted
    }
    return { success: false, error: error.message };
  }
}

async function listWorkspaces() {
  try {
    const root = await getOPFSRoot();
    const workspacesDir = await root.getDirectoryHandle('workspaces');
    const workspaces = [];

    for await (const [name, handle] of workspacesDir.entries()) {
      if (handle.kind === 'directory') {
        workspaces.push(name);
      }
    }

    return { success: true, workspaces: workspaces.sort() };
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return { success: true, workspaces: [] };
    }
    return { success: false, error: error.message };
  }
}

async function writeFile(data) {
  try {
    const fileHandle = await getFileHandle(data.workspaceId, data.path, true);
    const syncHandle = await fileHandle.createSyncAccessHandle();

    try {
      syncHandle.write(data.content, { at: 0 });
      syncHandle.flush();
    } finally {
      syncHandle.close();
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function readFile(data) {
  try {
    const fileHandle = await getFileHandle(data.workspaceId, data.path, false);
    const file = await fileHandle.getFile();
    const content = await file.arrayBuffer();
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteFile(data) {
  try {
    const workspaceHandle = await ensureWorkspaceDirectory(data.workspaceId);

    const pathParts = data.path.split('/');
    const fileName = pathParts.pop();
    const dirPath = pathParts.join('/');

    let targetDir = workspaceHandle;
    if (dirPath) {
      targetDir = await ensureDirectoryPath(workspaceHandle, dirPath);
    }

    await targetDir.removeEntry(fileName);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function collectFiles(dirHandle, currentPath, files) {
  for await (const [name, handle] of dirHandle.entries()) {
    const fullPath = currentPath ? `${currentPath}/${name}` : name;

    if (handle.kind === 'file') {
      files.push(fullPath);
    } else if (handle.kind === 'directory') {
      await collectFiles(handle, fullPath, files);
    }
  }
}

async function listFiles(data) {
  try {
    const workspaceHandle = await ensureWorkspaceDirectory(data.workspaceId);
    let targetDir = workspaceHandle;

    if (data.basePath) {
      try {
        targetDir = await ensureDirectoryPath(workspaceHandle, data.basePath);
      } catch (error) {
        if (error.name === 'NotFoundError') {
          return { success: true, files: [] };
        }
        throw error;
      }
    }

    const files = [];
    await collectFiles(targetDir, data.basePath || '', files);
    return { success: true, files: files.sort() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getQuota() {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        success: true,
        quota: {
          used: estimate.usage || 0,
          available: (estimate.quota || 0) - (estimate.usage || 0),
        },
      };
    }
    return { success: true, quota: { used: 0, available: 0 } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Worker message handler
self.addEventListener('message', async event => {
  const { type, data, id } = event.data;
  let result;

  try {
    switch (type) {
      case 'createWorkspace':
        result = await createWorkspace(data);
        break;
      case 'deleteWorkspace':
        result = await deleteWorkspace(data);
        break;
      case 'listWorkspaces':
        result = await listWorkspaces();
        break;
      case 'writeFile':
        result = await writeFile(data);
        break;
      case 'readFile':
        result = await readFile(data);
        break;
      case 'deleteFile':
        result = await deleteFile(data);
        break;
      case 'listFiles':
        result = await listFiles(data);
        break;
      case 'getQuota':
        result = await getQuota();
        break;
      default:
        result = { success: false, error: `Unknown operation: ${type}` };
    }
  } catch (error) {
    result = { success: false, error: error.message };
  }

  const response = { type, result, id };
  self.postMessage(response);
});
