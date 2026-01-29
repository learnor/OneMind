type TabType = 'finance' | 'todo' | 'inventory';

type NavigationEventListener = (tab: TabType) => void;

class NavigationEventEmitter {
  private listeners: NavigationEventListener[] = [];

  navigateToTab(tab: TabType) {
    // Call all listeners
    this.listeners.forEach(listener => {
      try {
        listener(tab);
      } catch (error) {
        console.error('Navigation event listener error:', error);
      }
    });
  }

  onNavigateToTab(callback: NavigationEventListener) {
    this.listeners.push(callback);
  }

  offNavigateToTab(callback: NavigationEventListener) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }
}

export const navigationEvents = new NavigationEventEmitter();
