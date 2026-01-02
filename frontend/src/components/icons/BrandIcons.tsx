/* eslint-disable react-refresh/only-export-components -- Exports both icon components and helper functions */
/**
 * Brand Icons for AI Providers
 *
 * Official SVG icons from Simple Icons (https://simpleicons.org)
 * for council members + chairman:
 * - Claude (Anthropic) - Official "A" logo
 * - ChatGPT (OpenAI) - Official hexagonal knot logo
 * - Gemini (Google) - Official 4-point sparkle logo
 * - Grok (xAI) - X logo
 * - DeepSeek - Custom whale icon
 * - Meta (Llama) - Meta infinity logo
 * - Moonshot (Kimi) - Moonshot crescent logo
 * - Chairman (Council synthesis) - Scale icon
 */

interface IconProps {
  size?: number | undefined;
  className?: string | undefined;
}

// Claude (Anthropic) - Official Anthropic "A" logo from Simple Icons
export function ClaudeIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Claude"
    >
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  );
}

// ChatGPT (OpenAI) - Official OpenAI hexagonal knot logo from Simple Icons
export function ChatGPTIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="ChatGPT"
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

// Gemini (Google) - Official Google Gemini sparkle logo from Simple Icons
export function GeminiIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Gemini"
    >
      <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
    </svg>
  );
}

// Grok (xAI) - Official X logo from Simple Icons
export function GrokIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Grok"
    >
      <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
    </svg>
  );
}

// DeepSeek - Stylized whale/dolphin icon (based on official branding)
export function DeepSeekIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="DeepSeek"
    >
      {/* DeepSeek whale/dolphin inspired icon */}
      <path d="M20.5 8.5c-.7-1.5-2-2.5-3.5-3-1.8-.5-3.8-.2-5.5.8-1.7 1-3 2.5-3.8 4.2-.8 1.7-1 3.5-.5 5.2.5 1.7 1.7 3 3.3 3.8 1.6.8 3.5.8 5.2.2 1.7-.6 3-1.8 3.8-3.3.5-1 .8-2 .8-3.1 0-.8-.1-1.6-.3-2.3" />
      <circle cx="10.5" cy="12.5" r="1.2" fill="white" />
      <path
        d="M5 10.5c.8-1.2 2-2 3.2-2.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 6c.8-1 1.8-1.7 3-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// Meta (Llama) - Official Meta infinity logo from Simple Icons
export function MetaIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Meta"
    >
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a4.883 4.883 0 0 0 1.271 2.15c.656.614 1.52.928 2.553.928 1.14 0 2.127-.36 2.942-.972.81-.617 1.597-1.462 2.414-2.524l.03-.04.03.04c.816 1.062 1.603 1.907 2.413 2.524.816.611 1.802.972 2.942.972 1.033 0 1.897-.314 2.552-.928a4.878 4.878 0 0 0 1.272-2.15c.139-.604.209-1.267.209-1.973 0-2.566-.703-5.24-2.044-7.306C15.598 5.31 13.883 4.03 11.915 4.03c-1.87 0-3.424.812-4.5 2.086C6.34 4.842 4.785 4.03 2.915 4.03zm0 1.5c1.34 0 2.53.682 3.457 1.763.697.813 1.277 1.852 1.694 3.036l.086.256a20.15 20.15 0 0 1 .69 2.865c.06.322.108.645.145.967.014.12.027.24.037.36l.003.037a2.655 2.655 0 0 1-.216-.4 6.68 6.68 0 0 1-.354-.863 15.45 15.45 0 0 1-.49-1.655c-.238-.929-.388-1.74-.388-2.345v-.004c0-.602.15-1.161.41-1.653.262-.496.647-.925 1.136-1.257.485-.33 1.068-.552 1.71-.66a6.57 6.57 0 0 1 1.015-.077c.347 0 .687.026 1.016.077.642.108 1.225.33 1.71.66.49.332.875.761 1.137 1.257.26.492.41 1.051.41 1.653v.004c0 .605-.15 1.416-.388 2.345a15.45 15.45 0 0 1-.49 1.655 6.68 6.68 0 0 1-.355.863 2.655 2.655 0 0 1-.216.4l.004-.037c.01-.12.022-.24.036-.36.037-.322.086-.645.145-.967.156-.858.388-1.83.69-2.865l.087-.256c.417-1.184.997-2.223 1.694-3.036.927-1.081 2.117-1.763 3.457-1.763 1.34 0 2.515.679 3.427 1.758.905 1.072 1.6 2.573 2.015 4.229.41 1.64.562 3.377.38 4.991a5.633 5.633 0 0 1-.577 1.998c-.258.517-.597.95-1.016 1.259a2.566 2.566 0 0 1-1.51.48c-.642 0-1.225-.172-1.712-.455a5.467 5.467 0 0 1-1.263-1.049 14.892 14.892 0 0 1-1.384-1.803l-.1-.148-.1.148a14.892 14.892 0 0 1-1.384 1.803c-.417.476-.85.847-1.263 1.05-.487.282-1.07.454-1.711.454a2.566 2.566 0 0 1-1.511-.48c-.42-.308-.758-.742-1.016-1.259a5.633 5.633 0 0 1-.576-1.998 15.21 15.21 0 0 1 .38-4.991c.414-1.656 1.11-3.157 2.014-4.229.912-1.079 2.087-1.758 3.427-1.758z" />
    </svg>
  );
}

// Moonshot (Kimi) - Crescent moon icon representing Moonshot AI
export function MoonshotIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Moonshot"
    >
      {/* Stylized crescent moon for Moonshot/Kimi */}
      <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
    </svg>
  );
}

// Chairman/Council - Scale icon (balance/synthesis) - Lucide style
export function ChairmanIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="Chairman"
    >
      {/* Scale - symbol of balance and synthesis (Lucide-style) */}
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </svg>
  );
}

// Map provider to icon component
export const PROVIDER_ICONS = {
  anthropic: ClaudeIcon,
  openai: ChatGPTIcon,
  google: GeminiIcon,
  xai: GrokIcon,
  deepseek: DeepSeekIcon,
  meta: MetaIcon,
  moonshot: MoonshotIcon,
  council: ChairmanIcon,
};

type ProviderName = keyof typeof PROVIDER_ICONS;

/**
 * Get the icon component for a provider
 * @param provider - Provider name
 * @returns React component for the icon
 */
export function getProviderIcon(
  provider: string
): ((props: IconProps) => React.JSX.Element) | null {
  return PROVIDER_ICONS[provider as ProviderName] ?? null;
}
