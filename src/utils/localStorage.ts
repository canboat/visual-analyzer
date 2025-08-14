/**
 * Centralized localStorage utility for the Visual Analyzer application
 * Provides type-safe access to localStorage with error handling and browser compatibility
 */

// Storage keys used throughout the application
export const STORAGE_KEYS = {
  // App panel settings
  FILTER_SETTINGS: 'visual_analyzer_settings',
  ACTIVE_TAB: 'visual_analyzer_active_tab',
  DATALIST_VISIBILITY: 'visual_analyzer_datalist_visible',
  FILTER_PANEL_OPEN: 'visual_analyzer_filter_panel_open',
  
  // Transform tab settings
  TRANSFORM_INPUT_VALUE: 'transformTab-inputValue',
  TRANSFORM_OUTPUT_FORMAT: 'transformTab-outputFormat',
  TRANSFORM_MESSAGE_HISTORY: 'transformTab-messageHistory',
  
  // Send tab settings
  SEND_MESSAGE_HISTORY: 'nmea2000MessageHistory',
  
  // Recording tab settings
  RECORDING_FORMAT: 'visual-analyzer-recording-format',
} as const

export type StorageKey = keyof typeof STORAGE_KEYS

// Define types for different storage values
export interface FilterSettings {
  filter: Record<string, any>
  doFiltering: boolean
  filterOptions: {
    showUnknownProprietaryPGNsOnSeparateLines?: boolean
    showPgn126208OnSeparateLines?: boolean
    showInfoPgns?: boolean
    maxHistorySize?: number
    pauseUpdates?: boolean
  }
  showDataList?: boolean
  lastSaved: string
}

export interface MessageHistoryItem {
  timestamp: string
  message: string
  format?: string
  [key: string]: any
}

/**
 * Type-safe localStorage wrapper with error handling
 */
class LocalStorageService {
  /**
   * Check if localStorage is available in the current environment
   */
  private isAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && window.localStorage !== null
    } catch (e) {
      return false
    }
  }

  /**
   * Get an item from localStorage with type safety and error handling
   * @param key - The storage key
   * @param defaultValue - Default value to return if item doesn't exist or parsing fails
   * @returns The stored value or default value
   */
  getItem<T>(key: string, defaultValue: T): T {
    try {
      if (!this.isAvailable()) {
        console.warn(`localStorage not available, returning default value for ${key}`)
        return defaultValue
      }

      const stored = window.localStorage.getItem(key)
      if (stored === null) {
        return defaultValue
      }

      return JSON.parse(stored)
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error)
      return defaultValue
    }
  }

  /**
   * Set an item in localStorage with error handling
   * @param key - The storage key
   * @param value - The value to store
   * @returns true if successful, false otherwise
   */
  setItem<T>(key: string, value: T): boolean {
    try {
      if (!this.isAvailable()) {
        console.warn(`localStorage not available, cannot save ${key}`)
        return false
      }

      window.localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error)
      return false
    }
  }

  /**
   * Remove an item from localStorage
   * @param key - The storage key
   * @returns true if successful, false otherwise
   */
  removeItem(key: string): boolean {
    try {
      if (!this.isAvailable()) {
        console.warn(`localStorage not available, cannot remove ${key}`)
        return false
      }

      window.localStorage.removeItem(key)
      return true
    } catch (error) {
      console.warn(`Failed to remove ${key} from localStorage:`, error)
      return false
    }
  }

  /**
   * Clear all localStorage items
   * @returns true if successful, false otherwise
   */
  clear(): boolean {
    try {
      if (!this.isAvailable()) {
        console.warn('localStorage not available, cannot clear')
        return false
      }

      window.localStorage.clear()
      return true
    } catch (error) {
      console.warn('Failed to clear localStorage:', error)
      return false
    }
  }

  /**
   * Get all keys from localStorage
   * @returns Array of keys
   */
  getAllKeys(): string[] {
    try {
      if (!this.isAvailable()) {
        return []
      }

      const keys: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key) {
          keys.push(key)
        }
      }
      return keys
    } catch (error) {
      console.warn('Failed to get localStorage keys:', error)
      return []
    }
  }
}

// Create and export singleton instance
export const localStorage = new LocalStorageService()

/**
 * Specialized methods for common use cases
 */

// Filter settings management
export const filterStorage = {
  save: (settings: Partial<FilterSettings>): boolean => {
    const currentSettings = filterStorage.load()
    const updatedSettings: FilterSettings = {
      ...currentSettings,
      ...settings,
      lastSaved: new Date().toISOString(),
    }
    return localStorage.setItem(STORAGE_KEYS.FILTER_SETTINGS, updatedSettings)
  },

  load: (): FilterSettings => {
    return localStorage.getItem(STORAGE_KEYS.FILTER_SETTINGS, {
      filter: {},
      doFiltering: false,
      filterOptions: {
        showUnknownProprietaryPGNsOnSeparateLines: false,
        showPgn126208OnSeparateLines: false,
        maxHistorySize: 10,
      },
      lastSaved: new Date().toISOString(),
    })
  },
}

// Tab management
export const tabStorage = {
  setActiveTab: (tabId: string): boolean => {
    return localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tabId)
  },

  getActiveTab: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB, null)
  },
}

// DataList visibility
export const dataListStorage = {
  setVisibility: (visible: boolean): boolean => {
    return localStorage.setItem(STORAGE_KEYS.DATALIST_VISIBILITY, visible)
  },

  getVisibility: (): boolean => {
    return localStorage.getItem(STORAGE_KEYS.DATALIST_VISIBILITY, true)
  },
}

// Message history management
export const messageHistoryStorage = {
  save: (key: string, history: MessageHistoryItem[]): boolean => {
    return localStorage.setItem(key, history)
  },

  load: (key: string): MessageHistoryItem[] => {
    return localStorage.getItem(key, [])
  },

  addMessage: (key: string, message: MessageHistoryItem, maxSize = 50): boolean => {
    const history = messageHistoryStorage.load(key)
    history.unshift(message)
    if (history.length > maxSize) {
      history.splice(maxSize)
    }
    return messageHistoryStorage.save(key, history)
  },
}

// Transform tab specific storage
export const transformTabStorage = {
  setInputValue: (value: string): boolean => {
    return localStorage.setItem(STORAGE_KEYS.TRANSFORM_INPUT_VALUE, value)
  },

  getInputValue: (): string => {
    return localStorage.getItem(STORAGE_KEYS.TRANSFORM_INPUT_VALUE, '')
  },

  setOutputFormat: (format: string): boolean => {
    return localStorage.setItem(STORAGE_KEYS.TRANSFORM_OUTPUT_FORMAT, format)
  },

  getOutputFormat: (): string => {
    return localStorage.getItem(STORAGE_KEYS.TRANSFORM_OUTPUT_FORMAT, 'canboat-json')
  },

  setMessageHistory: (history: MessageHistoryItem[]): boolean => {
    return messageHistoryStorage.save(STORAGE_KEYS.TRANSFORM_MESSAGE_HISTORY, history)
  },

  getMessageHistory: (): MessageHistoryItem[] => {
    return messageHistoryStorage.load(STORAGE_KEYS.TRANSFORM_MESSAGE_HISTORY)
  },

  addMessageToHistory: (message: MessageHistoryItem): boolean => {
    return messageHistoryStorage.addMessage(STORAGE_KEYS.TRANSFORM_MESSAGE_HISTORY, message)
  },
}

// Send tab specific storage
export const sendTabStorage = {
  setMessageHistory: (history: MessageHistoryItem[]): boolean => {
    return messageHistoryStorage.save(STORAGE_KEYS.SEND_MESSAGE_HISTORY, history)
  },

  getMessageHistory: (): MessageHistoryItem[] => {
    return messageHistoryStorage.load(STORAGE_KEYS.SEND_MESSAGE_HISTORY)
  },

  addMessageToHistory: (message: MessageHistoryItem): boolean => {
    return messageHistoryStorage.addMessage(STORAGE_KEYS.SEND_MESSAGE_HISTORY, message)
  },
}

// Recording tab specific storage
export const recordingStorage = {
  setFormat: (format: string): boolean => {
    return localStorage.setItem(STORAGE_KEYS.RECORDING_FORMAT, format)
  },

  getFormat: (): string => {
    return localStorage.getItem(STORAGE_KEYS.RECORDING_FORMAT, 'passthrough')
  },
}

// Generic storage operations for backward compatibility
export const storageOperations = {
  saveFilterSettings: filterStorage.save,
  loadFilterSettings: filterStorage.load,
  saveDataListVisibility: dataListStorage.setVisibility,
  loadDataListVisibility: dataListStorage.getVisibility,
  saveActiveTab: tabStorage.setActiveTab,
  loadActiveTab: tabStorage.getActiveTab,
}

export default localStorage
