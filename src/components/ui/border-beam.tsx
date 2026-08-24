import React from 'react'

export interface BorderBeamProps {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  borderWidth?: number
  squircle?: boolean
  anchor?: number
  className?: string
  style?: React.CSSProperties
}

export const BorderBeam: React.FC<BorderBeamProps> = ({
  size = 570,
  duration = 12,
  delay = 0,
  colorFrom = '#4265ff',
  colorTo = '#6ae523',
  borderWidth = 3,
  squircle = true,
  anchor = 90,
  className = '',
  style
}) => {
  return (
    <div
      style={
        {
          '--size': size,
          '--duration': duration,
          '--delay': `-${delay}s`,
          '--color-from': colorFrom,
          '--color-to': colorTo,
          '--border-width': borderWidth,
          '--anchor': anchor,
          ...style
        } as React.CSSProperties
      }
      className={`border-beam-container pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden ${className}`}
    >
      <div className={`border-beam-element ${squircle ? 'is-squircle' : ''}`} />
    </div>
  )
}

export default BorderBeam
