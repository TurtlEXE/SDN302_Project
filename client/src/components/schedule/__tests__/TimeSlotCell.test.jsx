import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeSlotCell } from '../TimeSlotCell.jsx';

describe('TimeSlotCell Component (P16)', () => {
  it('renders AVAILABLE slot and triggers onToggle on click', () => {
    const onToggle = vi.fn();
    const slot = { startTime: '08:00', endTime: '09:00', status: 'AVAILABLE' };

    render(<TimeSlotCell slot={slot} isSelected={false} onToggle={onToggle} />);

    const button = screen.getByTestId('slot-0800-0900');
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('08:00 - 09:00');

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(slot);
  });

  it('renders SELECTED state with proper active styling and checkmark', () => {
    const slot = { startTime: '09:00', endTime: '10:00', status: 'AVAILABLE' };

    render(<TimeSlotCell slot={slot} isSelected={true} onToggle={vi.fn()} />);

    const button = screen.getByTestId('slot-0900-1000');
    expect(button).toHaveAttribute('data-selected', 'true');
    expect(button.className).toContain('bg-brand-600');
  });

  it('renders HOLD slot as disabled with "Giữ chỗ" badge and prevents click', () => {
    const onToggle = vi.fn();
    const slot = { startTime: '10:00', endTime: '11:00', status: 'HOLD' };

    render(<TimeSlotCell slot={slot} isSelected={false} onToggle={onToggle} />);

    const button = screen.getByTestId('slot-1000-1100');
    expect(button).toBeDisabled();
    expect(screen.getByText('Giữ chỗ')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('renders BOOKED slot as disabled with "Đã đặt" badge and line-through style', () => {
    const slot = { startTime: '14:00', endTime: '15:00', status: 'BOOKED' };

    render(<TimeSlotCell slot={slot} isSelected={false} onToggle={vi.fn()} />);

    const button = screen.getByTestId('slot-1400-1500');
    expect(button).toBeDisabled();
    expect(screen.getByText('Đã đặt')).toBeInTheDocument();
  });

  it('renders BLOCKED slot as disabled with "Khóa" badge', () => {
    const slot = { startTime: '15:00', endTime: '16:00', status: 'BLOCKED' };

    render(<TimeSlotCell slot={slot} isSelected={false} onToggle={vi.fn()} />);

    const button = screen.getByTestId('slot-1500-1600');
    expect(button).toBeDisabled();
    expect(screen.getByText('Khóa')).toBeInTheDocument();
  });

  it('renders PAST slot as disabled with "Đã qua" badge', () => {
    const slot = { startTime: '06:00', endTime: '07:00', status: 'PAST' };

    render(<TimeSlotCell slot={slot} isSelected={false} onToggle={vi.fn()} />);

    const button = screen.getByTestId('slot-0600-0700');
    expect(button).toBeDisabled();
    expect(screen.getByText('Đã qua')).toBeInTheDocument();
  });
});

