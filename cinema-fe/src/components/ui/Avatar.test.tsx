import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders an image when src is provided', () => {
    render(<Avatar src="https://example.com/a.jpg" name="Alice" />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/a.jpg');
    expect(img.alt).toBe('Alice');
  });

  it('falls back to the first letter of the name when there is no src', () => {
    render(<Avatar name="Bob" />);
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('falls back to "?" when there is neither src nor name', () => {
    render(<Avatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
