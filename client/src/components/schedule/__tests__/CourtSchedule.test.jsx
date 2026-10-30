import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CourtSchedule } from '../CourtSchedule.jsx';
import { courtService } from '../../../services/court.service.js';

// Mock courtService
vi.mock('../../../services/court.service.js', () => ({
  courtService: {
    getCourtSchedule: vi.fn(),
  },
}));

describe('CourtSchedule Component (P16)', () => {
  const mockCourt = {
    id: 'court-1',
    name: 'Sân bóng đá 1',
    pricePerHourVnd: 200000,
    sportId: 'sport-1',
  };

  const mockFacility = {
    id: 'facility-1',
    name: 'CLB Thể Thao Sao Vàng',
    openTime: '06:00',
    closeTime: '22:00',
  };

  const mockScheduleResponse = {
    success: true,
    data: {
      courtId: 'court-1',
      courtName: 'Sân bóng đá 1',
      bookingDate: '2026-11-01',
      openTime: '06:00',
      closeTime: '22:00',
      slotStepMinutes: 60,
      pricePerHourVnd: 200000,
      slots: [
        { startTime: '06:00', endTime: '07:00', status: 'PAST' },
        { startTime: '07:00', endTime: '08:00', status: 'AVAILABLE' },
        { startTime: '08:00', endTime: '09:00', status: 'AVAILABLE' },
        { startTime: '09:00', endTime: '10:00', status: 'HOLD' },
        { startTime: '10:00', endTime: '11:00', status: 'BOOKED' },
        { startTime: '11:00', endTime: '12:00', status: 'BLOCKED' },
        { startTime: '17:00', endTime: '18:00', status: 'AVAILABLE' },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    courtService.getCourtSchedule.mockResolvedValue(mockScheduleResponse);
  });

  it('renders date tabs, legend, loads schedule data and displays slot grid', async () => {
    render(
      <BrowserRouter>
        <CourtSchedule court={mockCourt} facility={mockFacility} initialDate="2026-11-01" />
      </BrowserRouter>
    );

    // Date tabs visible
    expect(screen.getByText('Chọn ngày chơi (trong vòng 30 ngày)')).toBeInTheDocument();

    // Wait for schedule to load
    await waitFor(() => {
      expect(screen.getByTestId('time-slot-grid')).toBeInTheDocument();
    });

    expect(screen.getByTestId('slot-0700-0800')).toBeInTheDocument();
    expect(screen.getByTestId('slot-0800-0900')).toBeInTheDocument();
    expect(screen.getByTestId('slot-0900-1000')).toBeDisabled(); // HOLD
    expect(screen.getByTestId('slot-1000-1100')).toBeDisabled(); // BOOKED
  });

  it('selects contiguous slots and calculates merged range & estimated price correctly', async () => {
    render(
      <BrowserRouter>
        <CourtSchedule court={mockCourt} facility={mockFacility} initialDate="2026-11-01" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('time-slot-grid')).toBeInTheDocument();
    });

    // Select 07:00-08:00
    fireEvent.click(screen.getByTestId('slot-0700-0800'));
    // Select 08:00-09:00 (contiguous!)
    fireEvent.click(screen.getByTestId('slot-0800-0900'));

    // Verify summary appears
    expect(screen.getByTestId('selected-ranges-summary')).toBeInTheDocument();

    // Should merge into 07:00 - 09:00 (120 phút)
    expect(screen.getByText('07:00 - 09:00')).toBeInTheDocument();
    expect(screen.getByText('(120 phút)')).toBeInTheDocument();

    // 120 minutes @ 200,000 VND/hr = 400,000 VND
    const totalEl = screen.getByTestId('total-price-vnd');
    expect(totalEl.textContent).toContain('400.000');
  });

  it('detects disjoint slots and displays disjoint warning notice (PUB-05)', async () => {
    render(
      <BrowserRouter>
        <CourtSchedule court={mockCourt} facility={mockFacility} initialDate="2026-11-01" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('time-slot-grid')).toBeInTheDocument();
    });

    // Select 07:00-08:00 and 17:00-18:00 (gap in between)
    fireEvent.click(screen.getByTestId('slot-0700-0800'));
    fireEvent.click(screen.getByTestId('slot-1700-1800'));

    // Expect disjoint notice to be present
    expect(
      screen.getByText(/Bạn đang chọn 2 khoảng giờ không liền nhau/i)
    ).toBeInTheDocument();

    // Both merged ranges displayed in summary
    expect(
      within(screen.getByTestId('merged-range-0')).getByText('07:00 - 08:00')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('merged-range-1')).getByText('17:00 - 18:00')
    ).toBeInTheDocument();
  });

  it('clears selection when "Bỏ chọn" is clicked', async () => {
    render(
      <BrowserRouter>
        <CourtSchedule court={mockCourt} facility={mockFacility} initialDate="2026-11-01" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('time-slot-grid')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('slot-0700-0800'));
    expect(screen.getByTestId('selected-ranges-summary')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-clear-selection'));

    // Should return to empty state
    expect(screen.getByText('Chưa có ô giờ nào được chọn')).toBeInTheDocument();
  });
});
