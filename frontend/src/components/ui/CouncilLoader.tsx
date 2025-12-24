/**
 * CouncilLoader - Animated loader showing rotating LLM icons
 *
 * Displays the council members' icons in a carousel rotation,
 * conveying "the council is being consulted" during loading states.
 */

import { useState, useEffect } from 'react';
import { getProviderIcon } from '../icons';
import { PROVIDER_COLORS, PROVIDER_LABELS } from '../../config/modelPersonas';
import './CouncilLoader.css';

// Council members derived from centralized config
const COUNCIL_PROVIDERS = ['openai', 'anthropic', 'google', 'xai', 'deepseek'];
const COUNCIL_MEMBERS = COUNCIL_PROVIDERS.map(provider => ({
  icon: getProviderIcon(provider),
  color: PROVIDER_COLORS[provider],
  name: PROVIDER_LABELS[provider],
}));

export function CouncilLoader({
  size = 'medium',
  showText = true,
  text = 'Loading conversation...',
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Rotate through council members
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % COUNCIL_MEMBERS.length);
    }, 600);

    return () => clearInterval(interval);
  }, []);

  const sizeClass = `council-loader--${size}`;
  const iconSize = size === 'small' ? 20 : size === 'large' ? 40 : 28;

  return (
    <div className={`council-loader ${sizeClass}`}>
      <div className="council-loader__icons">
        {COUNCIL_MEMBERS.map((member, index) => {
          const Icon = member.icon;
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
              <Icon size={iconSize} />
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
export function CouncilLoaderCompact({ size = 24 }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % COUNCIL_MEMBERS.length);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const member = COUNCIL_MEMBERS[activeIndex];
  const Icon = member.icon;

  return (
    <div className="council-loader-compact" style={{ color: member.color }}>
      <Icon size={size} />
    </div>
  );
}

export default CouncilLoader;
