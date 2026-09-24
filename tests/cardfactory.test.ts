import { describe, it, expect } from 'vitest';
import { Card } from '../src/core/types';
import { Card3D } from '../src/gfx/Card3D';

describe('Card3D wrapper', () => {
  it('instantiates Card3D and manages face-up and target position state', () => {
    const card: Card = { id: 's_1', suit: 'spades', rank: 1, isFaceUp: false };
    const card3D = new Card3D(card);

    expect(card3D.card.id).toBe('s_1');
    expect(card3D.isFaceUp).toBe(false);

    card3D.setFaceUp(true);
    expect(card3D.isFaceUp).toBe(true);

    card3D.setTargetPosition(1.5, 2.0, 0.1);
    expect(card3D.targetPosition.x).toBe(1.5);
    expect(card3D.targetPosition.y).toBe(2.0);
    expect(card3D.targetPosition.z).toBe(0.1);
  });
});
