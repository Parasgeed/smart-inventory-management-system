// src/tests/App.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

describe('App', () => {
  it('should render the application sidebar branding', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText('Smart Inventory')).toBeInTheDocument();
  });
});
