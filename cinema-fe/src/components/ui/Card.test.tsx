import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardBody, CardTitle } from './Card';

describe('Card family', () => {
  it('composes Card, CardBody and CardTitle', () => {
    render(
      <Card>
        <CardTitle>Title</CardTitle>
        <CardBody>Body text</CardBody>
      </Card>,
    );
    expect(screen.getByText('Title').tagName).toBe('H3');
    expect(screen.getByText('Body text')).toBeInTheDocument();
  });
});
