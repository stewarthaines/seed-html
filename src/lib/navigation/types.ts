import type { Writable } from 'svelte/store';

// Available views in the application
export type ViewType =
  | 'workspace' // Workspace selection and management
  | 'metadata' // EPUB metadata editing
  | 'manifest' // File listing and management
  | 'navigation' // Table of contents editing
  | 'spine' // Chapter ordering
  | 'settings'; // Application settings

// Navigation store state
export interface NavigationState {
  currentView: ViewType;
  previousView: ViewType | null;
  viewHistory: ViewType[];
  viewData: Partial<Record<ViewType, any>>;
  isTransitioning: boolean;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
}

// Navigation options
export interface NavigationOptions {
  force?: boolean;
  replaceHistory?: boolean;
  viewData?: any;
}

// Navigation guard function
export type NavigationGuard = (from: ViewType, to: ViewType) => boolean | Promise<boolean>;

// Store interface
export interface NavigationStore extends Writable<NavigationState> {
  navigateTo(view: ViewType, options?: NavigationOptions): Promise<boolean>;
  canNavigate(targetView?: ViewType): Promise<boolean>;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  setViewData(view: ViewType, data: any): void;
  getViewData<T = any>(view: ViewType): T | null;
  clearViewData(view: ViewType): void;
  addNavigationGuard(guard: NavigationGuard): string;
  removeNavigationGuard(guardId: string): boolean;
  initialize(): void;
}

// View component interface
export interface ViewComponent {
  // Component lifecycle
  onViewEnter?(data?: any): Promise<void> | void;
  onViewLeave?(): Promise<void> | void;

  // Data persistence
  getViewData?(): any;
  setViewData?(data: any): void;

  // Navigation integration
  canLeave?(): Promise<boolean> | boolean;
}

// View-specific data types for type safety
export interface MetadataViewData {
  title: string;
  author: string;
  language: string;
  identifier: string;
  hasUnsavedChanges: boolean;
}

export interface ManifestViewData {
  selectedItems: string[];
  sortOrder: 'name' | 'type' | 'modified';
  searchQuery: string;
}

export interface SpineViewData {
  selectedChapter: string | null;
  draggedItem: string | null;
}

export interface WorkspaceViewData {
  selectedWorkspace: string | null;
  recentWorkspaces: string[];
}

export interface NavigationViewData {
  tocExpanded: boolean;
  selectedNavItem: string | null;
  editMode: boolean;
}

export interface SettingsViewData {
  activeTab: 'general' | 'editor' | 'export' | 'advanced';
  hasUnsavedChanges: boolean;
}
