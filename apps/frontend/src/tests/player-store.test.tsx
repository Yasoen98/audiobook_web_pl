import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerCard } from '../components/dashboard/player-card';

describe('PlayerCard', () => {
  it('pozwala przełączać odtwarzanie', () => {
    render(<PlayerCard />);
    const button = screen.getByRole('button', { name: /odtwarzaj/i });
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: /pauza/i })).toBeInTheDocument();
  });
});
