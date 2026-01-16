/**
 * Web Share API Utility
 * Enables native sharing on mobile devices
 * Falls back gracefully on unsupported browsers
 */

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
}

/**
 * Check if Web Share API is supported
 */
export const isShareSupported = (): boolean => {
  return navigator.share !== undefined;
};

/**
 * Share content using native share sheet
 * @param data - ShareData object with title, text, and/or url
 * @returns Promise that resolves when sharing is complete or rejects if cancelled/failed
 */
export const share = async (data: ShareData): Promise<void> => {
  if (!isShareSupported()) {
    throw new Error('Web Share API not supported');
  }

  try {
    await navigator.share(data);
  } catch (error) {
    // User cancelled or error occurred
    if (error instanceof Error && error.name === 'AbortError') {
      // User cancelled - not really an error
      return;
    }
    throw error;
  }
};

/**
 * Share a conversation
 * @param title - Conversation title
 * @param summary - Brief summary of the conversation
 */
export const shareConversation = async (title: string, summary?: string): Promise<void> => {
  const shareData: ShareData = {
    title: `AxCouncil: ${title}`,
    text: summary || 'Check out this AI council decision',
    url: window.location.href,
  };

  return share(shareData);
};

/**
 * Share text content
 * @param text - Text to share
 */
export const shareText = async (text: string): Promise<void> => {
  return share({ text });
};

/**
 * Share current page
 * @param title - Optional custom title
 */
export const sharePage = async (title?: string): Promise<void> => {
  return share({
    title: title || document.title,
    url: window.location.href,
  });
};

/**
 * Copy to clipboard as fallback for unsupported browsers
 * @param text - Text to copy
 */
export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }
  }
};

export const webShare = {
  isSupported: isShareSupported,
  share,
  shareConversation,
  shareText,
  sharePage,
  copyToClipboard,
};

export default webShare;
