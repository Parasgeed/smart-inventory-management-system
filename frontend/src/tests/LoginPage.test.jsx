// frontend/src/tests/LoginPage.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import client from '../api/client';

// Mock client
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders in Sign In mode by default', () => {
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /smart inventory/i })).toBeInTheDocument();
    expect(screen.getByText(/sign in to access your dashboard/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
    
    const submitBtn = container.querySelector('#submit-auth-btn');
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toHaveTextContent('Sign In');
  });

  it('toggles to Create Account mode when Create Account tab is clicked', () => {
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const registerTab = container.querySelector('#tab-register');
    fireEvent.click(registerTab);

    expect(screen.getByText(/create a new account to get started/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    
    const submitBtn = container.querySelector('#submit-auth-btn');
    expect(submitBtn).toHaveTextContent('Create Account');
  });

  it('toggles between modes using the bottom link', () => {
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const toggleLink = container.querySelector('#toggle-auth-mode-link');
    fireEvent.click(toggleLink);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();

    const switchBackLink = container.querySelector('#toggle-auth-mode-link');
    fireEvent.click(switchBackLink);

    expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
  });

  it('displays validation error if passwords do not match in registration mode', async () => {
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(container.querySelector('#tab-register'));

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'newuser123' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'differentpassword' } });

    fireEvent.click(container.querySelector('#submit-auth-btn'));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(client.post).not.toHaveBeenCalled();
  });

  it('displays validation error if password is too short in registration mode', async () => {
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(container.querySelector('#tab-register'));

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'newuser123' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } });

    fireEvent.click(container.querySelector('#submit-auth-btn'));

    expect(await screen.findByText(/password must be at least 8 characters long/i)).toBeInTheDocument();
    expect(client.post).not.toHaveBeenCalled();
  });

  it('successfully registers, auto-logins, and navigates to dashboard', async () => {
    client.post.mockImplementation((url) => {
      if (url === '/auth/register') {
        return Promise.resolve({ data: { message: 'User registered successfully', user_id: 10 } });
      }
      if (url === '/auth/login') {
        return Promise.resolve({ data: { access_token: 'fake-jwt-token' } });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    client.get.mockImplementation((url) => {
      if (url === '/auth/me') {
        return Promise.resolve({ data: { id: 10, username: 'testuser', email: 'test@example.com', role_id: 2 } });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(container.querySelector('#tab-register'));

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'validuser' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'valid@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'strongpassword123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'strongpassword123' } });

    fireEvent.click(container.querySelector('#submit-auth-btn'));

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/auth/register', {
        username: 'validuser',
        email: 'valid@example.com',
        password: 'strongpassword123',
      });
      expect(localStorage.getItem('token')).toBe('fake-jwt-token');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('displays backend error message if registration fails', async () => {
    client.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { detail: 'Email already registered' },
      },
    });

    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.click(container.querySelector('#tab-register'));

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'existinguser' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'exists@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'strongpassword123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'strongpassword123' } });

    fireEvent.click(container.querySelector('#submit-auth-btn'));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
  });
});
