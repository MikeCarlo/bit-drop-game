import React from 'react';
import { brandGutterDataUri } from '../brandArt';

const TILE = brandGutterDataUri();

/** Landscape side panel: repeating square-block brand art. Pointer-events none so play is unaffected. */
export function BrandGutter({ side }: { side: 'left' | 'right' }) {
  return (
    <div
      aria-hidden
      data-testid={`bitdrop-gutter-${side}`}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        alignSelf: 'stretch',
        pointerEvents: 'none',
        backgroundColor: '#020209',
        backgroundImage: `url("${TILE}")`,
        backgroundRepeat: 'repeat',
        backgroundPosition: side === 'right' ? 'center 48px' : 'center top',
        backgroundSize: 'min(92%, 168px) auto',
        transform: side === 'right' ? 'scaleX(-1)' : undefined,
      }}
    />
  );
}
