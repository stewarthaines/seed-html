// @ts-nocheck
// WebGL 3D Annotation Script - runs inside preview iframe
(function () {
  // Mini WebGL helper for creating rotating 3D shapes
  class Simple3D {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!this.gl) return;

      this.rotation = 0;
      this.init();
    }

    init() {
      const gl = this.gl;

      // Vertex shader with proper 3D projection
      const vsSource =
        'attribute vec4 aVertexPosition;\n' +
        'uniform mat4 uRotationMatrix;\n' +
        'uniform mat4 uProjectionMatrix;\n' +
        'varying lowp vec4 vColor;\n' +
        'void main() {\n' +
        '  vec4 rotatedPos = uRotationMatrix * aVertexPosition;\n' +
        '  rotatedPos.z -= 3.0;\n' +
        '  gl_Position = uProjectionMatrix * rotatedPos;\n' +
        '  vec3 pos = aVertexPosition.xyz * 0.5 + 0.5;\n' +
        '  vColor = vec4(pos.x * 0.8 + 0.2, pos.y * 0.8 + 0.2, pos.z * 0.8 + 0.2, 1.0);\n' +
        '}';

      // Fragment shader - colors based on position
      const fsSource =
        'varying lowp vec4 vColor;\n' + 'void main() {\n' + '  gl_FragColor = vColor;\n' + '}';

      // Compile shaders
      const vertexShader = this.loadShader(gl.VERTEX_SHADER, vsSource);
      const fragmentShader = this.loadShader(gl.FRAGMENT_SHADER, fsSource);

      if (!vertexShader || !fragmentShader) {
        console.error('Failed to compile shaders');
        return;
      }

      // Create program
      this.program = gl.createProgram();
      gl.attachShader(this.program, vertexShader);
      gl.attachShader(this.program, fragmentShader);
      gl.linkProgram(this.program);

      // Check for program linking errors
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(this.program);
        console.error('Program linking failed:', error);
        gl.deleteProgram(this.program);
        return;
      }

      console.log('WebGL program linked successfully');

      // Get locations
      this.programInfo = {
        attribLocations: {
          vertexPosition: gl.getAttribLocation(this.program, 'aVertexPosition'),
        },
        uniformLocations: {
          rotationMatrix: gl.getUniformLocation(this.program, 'uRotationMatrix'),
          projectionMatrix: gl.getUniformLocation(this.program, 'uProjectionMatrix'),
        },
      };

      // Create perspective projection matrix
      this.projectionMatrix = this.createPerspectiveMatrix(45, 1.0, 0.1, 100.0);
    }

    createPerspectiveMatrix(fovy, aspect, near, far) {
      const f = 1.0 / Math.tan((fovy * Math.PI) / 360);
      const rangeInv = 1 / (near - far);

      return [
        f / aspect,
        0,
        0,
        0,
        0,
        f,
        0,
        0,
        0,
        0,
        (near + far) * rangeInv,
        -1,
        0,
        0,
        near * far * rangeInv * 2,
        0,
      ];
    }

    loadShader(type, source) {
      const gl = this.gl;
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      // Check for shader compilation errors
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        console.error('Shader compilation failed:', error);
        console.error('Shader source:', source);
        gl.deleteShader(shader);
        return null;
      }

      console.log(
        'Shader compiled successfully:',
        type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'
      );
      return shader;
    }

    createCube() {
      const positions = [
        // Front face (z = 0.5)
        -0.5,
        -0.5,
        0.5, // 0
        0.5,
        -0.5,
        0.5, // 1
        0.5,
        0.5,
        0.5, // 2
        -0.5,
        0.5,
        0.5, // 3

        // Back face (z = -0.5)
        -0.5,
        -0.5,
        -0.5, // 4
        -0.5,
        0.5,
        -0.5, // 5
        0.5,
        0.5,
        -0.5, // 6
        0.5,
        -0.5,
        -0.5, // 7

        // Top face (y = 0.5)
        -0.5,
        0.5,
        -0.5, // 8
        -0.5,
        0.5,
        0.5, // 9
        0.5,
        0.5,
        0.5, // 10
        0.5,
        0.5,
        -0.5, // 11

        // Bottom face (y = -0.5)
        -0.5,
        -0.5,
        -0.5, // 12
        0.5,
        -0.5,
        -0.5, // 13
        0.5,
        -0.5,
        0.5, // 14
        -0.5,
        -0.5,
        0.5, // 15

        // Right face (x = 0.5)
        0.5,
        -0.5,
        -0.5, // 16
        0.5,
        0.5,
        -0.5, // 17
        0.5,
        0.5,
        0.5, // 18
        0.5,
        -0.5,
        0.5, // 19

        // Left face (x = -0.5)
        -0.5,
        -0.5,
        -0.5, // 20
        -0.5,
        -0.5,
        0.5, // 21
        -0.5,
        0.5,
        0.5, // 22
        -0.5,
        0.5,
        -0.5, // 23
      ];

      const indices = [
        0,
        1,
        2,
        0,
        2,
        3, // front
        4,
        5,
        6,
        4,
        6,
        7, // back
        8,
        9,
        10,
        8,
        10,
        11, // top
        12,
        13,
        14,
        12,
        14,
        15, // bottom
        16,
        17,
        18,
        16,
        18,
        19, // right
        20,
        21,
        22,
        20,
        22,
        23, // left
      ];

      const gl = this.gl;

      // Create position buffer
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

      // Create index buffer
      const indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

      return { position: positionBuffer, indices: indexBuffer, count: indices.length };
    }

    render(shape) {
      if (!this.gl || !this.program) {
        console.error('WebGL context or program not available');
        return;
      }

      const gl = this.gl;

      // Clear with dark blue for better cube visibility
      gl.clearColor(0.1, 0.1, 0.4, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);

      // Use program
      gl.useProgram(this.program);

      // Bind buffers
      gl.bindBuffer(gl.ARRAY_BUFFER, shape.position);
      gl.vertexAttribPointer(
        this.programInfo.attribLocations.vertexPosition,
        3,
        gl.FLOAT,
        false,
        0,
        0
      );
      gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);

      // Create rotation matrix
      this.rotation += 0.01;
      const c = Math.cos(this.rotation);
      const s = Math.sin(this.rotation);
      const rotationMatrix = [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];

      gl.uniformMatrix4fv(this.programInfo.uniformLocations.rotationMatrix, false, rotationMatrix);

      // Set projection matrix
      gl.uniformMatrix4fv(
        this.programInfo.uniformLocations.projectionMatrix,
        false,
        this.projectionMatrix
      );

      // Draw
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, shape.indices);
      gl.drawElements(gl.TRIANGLES, shape.count, gl.UNSIGNED_SHORT, 0);

      // Check for WebGL errors
      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        console.error('WebGL error during render:', this.getGLErrorString(error));
      }
    }

    getGLErrorString(error) {
      const gl = this.gl;
      switch (error) {
        case gl.NO_ERROR:
          return 'NO_ERROR';
        case gl.INVALID_ENUM:
          return 'INVALID_ENUM';
        case gl.INVALID_VALUE:
          return 'INVALID_VALUE';
        case gl.INVALID_OPERATION:
          return 'INVALID_OPERATION';
        case gl.OUT_OF_MEMORY:
          return 'OUT_OF_MEMORY';
        case gl.CONTEXT_LOST_WEBGL:
          return 'CONTEXT_LOST_WEBGL';
        default:
          return 'UNKNOWN_ERROR';
      }
    }
  }

  // Initialize WebGL annotations when DOM is ready
  function initWebGLAnnotations() {
    console.log('WebGL Annotations: Initializing in preview frame');

    // Find all annotation elements in the current document
    const annotations = document.querySelectorAll('.webgl-annotation, [data-shape]');

    console.log('WebGL Annotations: Found', annotations.length, 'annotation(s)');

    annotations.forEach((element, index) => {
      console.log('Processing annotation', index, element);

      // Get the type from data attribute or text content
      const _type = element.dataset.shape || element.textContent.toLowerCase().trim();

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = 300;
      canvas.style.cssText =
        'display: block; margin: 1em auto; border: 1px solid #ccc; border-radius: 8px;';

      console.log('Canvas created for annotation', index);

      // Initialize WebGL
      const renderer = new Simple3D(canvas);
      if (!renderer.gl) {
        console.warn('WebGL not supported for annotation', index);
        const fallback = document.createElement('div');
        fallback.style.cssText =
          'width: 300px; height: 300px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; margin: 1em auto; border: 1px solid #ccc; border-radius: 8px;';
        fallback.textContent = 'WebGL not supported';
        element.appendChild(fallback);
        return;
      }

      console.log('WebGL initialized for annotation', index);

      // Create shape and start animation
      const shape = renderer.createCube();

      function animate() {
        renderer.render(shape);
        requestAnimationFrame(animate);
      }
      animate();

      console.log('Animation started for annotation', index);

      // Handle inline vs block elements differently
      if (element.tagName === 'SPAN' || element.tagName === 'EM') {
        // For inline elements, highlight and insert canvas after
        element.style.cssText = 'color: #007acc; font-weight: bold; cursor: help;';
        element.parentNode.insertBefore(canvas, element.nextSibling);
      } else {
        // For block elements, append canvas inside
        element.appendChild(canvas);
      }

      console.log('WebGL canvas inserted for annotation', index);
    });

    // Handle test markers
    const testMarkers = document.querySelectorAll('.webgl-test');
    testMarkers.forEach((marker, index) => {
      const badge = document.createElement('span');
      badge.style.cssText =
        'display: inline-block; padding: 0.25em 0.5em; background: #e3f2fd; color: #1976d2; border-radius: 4px; font-size: 0.9em; margin-left: 0.5em;';
      badge.textContent = 'WebGL Active ✓';
      marker.appendChild(badge);
      console.log('WebGL test marker processed', index);
    });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebGLAnnotations);
  } else {
    // DOM already loaded (script injected after content)
    initWebGLAnnotations();
  }

  console.log('WebGL 3D Annotations script loaded');
})();
