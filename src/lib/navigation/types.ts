import type { Writable } from 'svelte/store';

// Available views in the application
export type ViewType =
  | 'about' // About information and licenses
  | 'workspace' // Workspace selection and management
  | 'metadata' // EPUB metadata editing
  | 'manifest' // File listing and management
  | 'navigation' // Table of contents editing
  | 'spine' // Chapter ordering
  | 'chapters' // Spine reordering & bulk operations
  | 'publish' // Packaged epub output management
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
