/**
 * CouncilLoader - Animated loader showing rotating LLM icons
 *
 * Displays the council members' icons in a carousel rotation,
 * conveying "the council is being consulted" during loading states.
 *
 * The list of providers is fetched dynamically from the backend,
 * ensuring the carousel reflects the actual LLMs configured in the system.
 */

import { useState, useEffect, useMemo } from 'react';
import { getProviderIcon } from '../icons';
import { PROVIDER_COLORS, PROVIDER_LABELS } from '../../config/modelPersonas';
import { useCouncilStats } from '../../hooks/useCouncilStats';
import './CouncilLoader.css';

type LoaderSize = 'small' | 'medium' | 'large';

interface CouncilLoaderProps {
  size?: LoaderSize | undefined;
  showText?: boolean | undefined;
  text?: string | undefined;
  companyId?: string | null;
}

interface CouncilLoaderCompactProps {
  size?: number | undefined;
  companyId?: string | null;
}

interface CouncilMember {
  icon: NonNullable<ReturnType<typeof getProviderIcon>>;
  color: string;
  name: string;
}

/**
 * Build council members array from a list of provider names.
 * Filters out providers without icons.
 */
function buildCouncilMembers(providers: string[]): CouncilMember[] {
  return providers
    .map((provider) => {
      const icon = getProviderIcon(provider);
      return {
        icon,
        color: PROVIDER_COLORS[provider as keyof typeof PROVIDER_COLORS] || PROVIDER_COLORS.unknown,
        name: PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS] || provider,
      };
    })
    .filter((member): member is CouncilMember => member.icon !== null);
}

export function CouncilLoader({
  size = 'medium',
  showText = true,
  text = 'Loading conversation...',
  companyId,
}: CouncilLoaderProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { providers } = useCouncilStats(companyId);

  // Build council members from dynamic providers list
  const councilMembers = useMemo(() => buildCouncilMembers(providers), [providers]);

  // Rotate through council members
  useEffect(() => {
    if (councilMembers.length === 0) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % councilMembers.length);
    }, 600);

    return () => clearInterval(interval);
  }, [councilMembers.length]);

  const sizeClass = `council-loader--${size}`;
  const iconSize = size === 'small' ? 20 : size === 'large' ? 40 : 28;

  // Don't render if no members (shouldn't happen, but safe fallback)
  if (councilMembers.length === 0) {
    return showText ? <p className="council-loader__text">{text}</p> : null;
  }

  return (
    <div className={`council-loader ${sizeClass}`}>
      <div className="council-loader__icons">
        {councilMembers.map((member, index) => {
          const IconComponent = member.icon;
          const isActive = index === activeIndex;

          return (
            <div
              key={member.name}
              className={`council-loader__icon ${isActive ? 'active' : ''}`}
              style={{
                color: member.color,
                opacity: isActive ? 1 : 0.2,
                transform: isActive ? 'scale(1.2)' : 'scale(0.8)',
              }}
            >
              <IconComponent size={iconSize} />
            </div>
          );
        })}
      </div>
      {showText && <p className="council-loader__text">{text}</p>}
    </div>
  );
}

/**
 * Compact version - single icon that cycles through members
 * Good for inline loading indicators
 */
export function CouncilLoaderCompact({ size = 24, companyId }: CouncilLoaderCompactProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { providers } = useCouncilStats(companyId);

  // Build council members from dynamic providers list
  const councilMembers = useMemo(() => buildCouncilMembers(providers), [providers]);

  useEffect(() => {
    if (councilMembers.length === 0) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % councilMembers.length);
    }, 500);

    return () => clearInterval(interval);
  }, [councilMembers.length]);

  const member = councilMembers[activeIndex];
  if (!member) return null;
  const IconComponent = member.icon;

  return (
    <div className="council-loader-compact" style={{ color: member.color }}>
      <IconComponent size={size} />
    </div>
  );
}

export default CouncilLoader;
