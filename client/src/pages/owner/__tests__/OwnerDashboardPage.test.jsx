import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OwnerDashboardPage } from '../OwnerDashboardPage.jsx';
import { ownerService } from '../../../services/owner.service.js';

vi.mock('../../../services/owner.service.js', () => ({
  ownerService: {
    listFacilities: vi.fn(),
    getDashboard: vi.fn(),
    completeBooking: vi.fn(),
    markNoShowBooking: vi.fn(),
  },
}));

describe('OwnerDashboardPage Component (P18)', () => {
  const mockFacilities = [
    { _id: 'f-1', name: 'CLB Sao Vàng' },
    { _id: 'f-2', name: 'Sân Cầu Lông Tuổi Trẻ' },
  ];

  const mockDashboardData = {
    bookingsToday: 5,
    completedBookings: 3,
    cancelledBookings: 1,
    totalRevenueVnd: 1250000,
    totalRefundedVnd: 0,
    pendingRefundVnd: 0,
    netRevenueVnd: 1250000,
    upcomingBookings: [
      {
        _id: 'b-101',
        id: 'b-101',
        bookingCode: 'BK-20261101-001',
        snapshot: { courtName: 'Sân 1', facilityName: 'CLB Sao Vàng' },
        startTime: '18:00',
        endTime: '19:30',
        durationMinutes: 90,
        totalPriceVnd: 450000,
        status: 'CONFIRMED',
      },
    ],
    unprocessedPastBookings: [
      {
        _id: 'b-100',
        id: 'b-100',
        bookingCode: 'BK-20261030-099',
        snapshot: { courtName: 'Sân 2' },
        bookingDate: '2026-10-30',
        startTime: '16:00',
        endTime: '17:00',
        totalPriceVnd: 200000,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard with KPI cards and financial notice', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.getDashboard.mockResolvedValue({
      data: mockDashboardData,
    });

    render(
      <BrowserRouter>
        <OwnerDashboardPage />
      </BrowserRouter>
    );

    // Header & notice
    expect(screen.getByText('Tổng quan Vận hành Chủ sân')).toBeInTheDocument();
    expect(
      screen.getByText(/Số liệu thống kê doanh thu phân bổ từ cổng VNPay/)
    ).toBeInTheDocument();

    // KPI cards
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // Bookings today
      expect(screen.getByText('3')).toBeInTheDocument(); // Completed
      expect(screen.getByText('1')).toBeInTheDocument(); // Cancelled
    });

    // Upcoming match table
    expect(screen.getByText('BK-20261101-001')).toBeInTheDocument();
  });

  it('handles quick action completion on past unserviced bookings', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.getDashboard.mockResolvedValue({
      data: mockDashboardData,
    });
    ownerService.completeBooking.mockResolvedValue({ success: true });

    render(
      <BrowserRouter>
        <OwnerDashboardPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/BK-20261030-099/)).toBeInTheDocument();
    });

    const completeBtn = screen.getByRole('button', { name: /^Hoàn tất$/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(ownerService.completeBooking).toHaveBeenCalledWith('b-100');
    });
  });
});
