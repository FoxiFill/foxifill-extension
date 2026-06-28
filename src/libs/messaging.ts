import { Message } from "./types";

/**
 * Messaging utility for Chrome extension communication
 */
export class Messaging {
  /**
   * Send message to background script
   */
  static async sendToBackground(message: Message): Promise<any> {
    console.log('Messaging.sendToBackground called with:', message);

    return new Promise((resolve, reject) => {
      // Check if extension context is valid
      if (!chrome.runtime?.id) {
        console.error('Extension context invalidated');
        reject(new Error('Extension context invalidated. Please reload the page.'));
        return;
      }

      // Validate message structure
      if (!message || typeof message !== 'object' || !message.type) {
        console.error('Invalid message structure in sendToBackground:', message);
        reject(new Error('Invalid message structure'));
        return;
      }

      try {
        chrome.runtime.sendMessage(message, (response) => {
          console.log('Background response received:', response);

          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);

            // Check for specific error messages
            if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
              reject(new Error('Extension context invalidated. Please reload the page.'));
            } else {
              reject(chrome.runtime.lastError);
            }
          } else if (!response) {
            console.error('No response received from background script');
            reject(new Error('No response from background script'));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        console.error('Error sending message to background:', error);
        reject(error);
      }
    });
  }

  /**
   * Send message to content script
   */
  static async sendToContent(tabId: number, message: Message): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Send message to all content scripts
   */
  static async sendToAllTabs(message: Message): Promise<void> {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await this.sendToContent(tab.id, message);
        } catch {
          // Ignore errors for tabs without content scripts
        }
      }
    }
  }

  /**
   * Listen for messages
   */
  static onMessage(callback: (message: Message, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => boolean | void): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      return callback(message, sender, sendResponse);
    });
  }

  /**
   * Listen for messages from background script
   */
  static onBackgroundMessage(callback: (message: Message) => void): void {
    chrome.runtime.onMessage.addListener((message: Message, sender) => {
      if (!sender.tab) {
        callback(message);
      }
    });
  }

  /**
   * Listen for messages from content scripts
   */
  static onContentMessage(callback: (message: Message, tabId?: number) => void): void {
    chrome.runtime.onMessage.addListener((message: Message, sender) => {
      if (sender.tab) {
        callback(message, sender.tab.id);
      }
    });
  }
}
