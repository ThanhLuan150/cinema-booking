import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarRatingInput } from './StarRatingInput';

describe('StarRatingInput', () => {
  it('renders 5 stars by default, filled up to the value', () => {
    render(<StarRatingInput value={3} onChange={() => {}} />);
    const stars = screen.getAllByRole('button');
    expect(stars).toHaveLength(5);
    expect(stars[0]).toHaveTextContent('★');
    expect(stars[2]).toHaveTextContent('★');
    expect(stars[3]).toHaveTextContent('☆');
  });

  it('calls onChange with the clicked star number', () => {
    const onChange = vi.fn();
    render(<StarRatingInput value={1} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('4 stars'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('previews the hovered rating', () => {
    render(<StarRatingInput value={1} onChange={() => {}} />);
    fireEvent.mouseEnter(screen.getByLabelText('5 stars'));
    const stars = screen.getAllByRole('button');
    expect(stars[4]).toHaveTextContent('★');
  });

  it('supports a custom max', () => {
    render(<StarRatingInput value={0} onChange={() => {}} max={3} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
