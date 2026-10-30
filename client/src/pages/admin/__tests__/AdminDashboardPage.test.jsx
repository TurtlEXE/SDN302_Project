import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminDashboardPage } from '../AdminDashboardPage.jsx';
import { adminService } from '../../../services/admin.service.js';

vi.mock('../../../services/admin.service.js', () => ({
  adminService: {
    getDashboard: vi.fn(),
  },
}));

describe('AdminDashboardPage Component (P19)', () => {
  const mockDashboardData = {
    totalCustomers: 45,
    totalOwners: 12,
    totalPublishedFacilities: 8,
    totalActiveCourts: 32,
    totalBookingsMonth: 120,
    bookingsByStatus: {
      PENDING_PAYMENT: 5,
      CONFIRMED: 40,
      COMPLETED: 60,
      CANCELLED: 10,
      EXPIRED: 3,
      NO_SHOW: 2,
    },
    totalCollectedVnd: 24000000,
    totalRefundedVnd: 1200000,
    totalPendingRefundVnd: 500000,
    netCollectedVnd: 22800000,
    unresolvedExceptionTransactions: 2,
    failedEmailsCount: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then displays KPIs', async () => {
    adminService.getDashboard.mockResolvedValue({
      success: true,
      data: mockDashboardData,
    });

    render(
      <BrowserRouter>
        <AdminDashboardPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Tổng quan Vận hành Toàn hệ thống/i)).toBeInTheDocument();

    await waitFor(() => {
      // Total accounts: 45 + 12 = 57
      expect(screen.getByText('57')).toBeInTheDocument();
      // Total facilities
      expect(screen.getByText('8')).toBeInTheDocument();
      // Total bookings
      expect(screen.getByText('120')).toBeInTheDocument();
      // Status breakdown
      expect(screen.getByText('Xác nhận')).toBeInTheDocument();
      expect(screen.getByText('Hoàn tất')).toBeInTheDocument();
    });
  });

  it('displays operational alert banners for pending refunds, exceptions, and failed emails', async () => {
    adminService.getDashboard.mockResolvedValue({
      success: true,
      data: mockDashboardData,
    });

    render(
      <BrowserRouter>
        <AdminDashboardPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('alert-pending-refunds')).toBeInTheDocument();
      expect(screen.getByTestId('alert-exceptions')).toBeInTheDocument();
      expect(screen.getByTestId('alert-failed-emails')).toBeInTheDocument();
    });
  });

  it('triggers filter update when dates are selected and cleared', async () => {
    adminService.getDashboard.mockResolvedValue({
      success: true,
      data: mockDashboardData,
    });

    render(
      <BrowserRouter>
        <AdminDashboardPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(adminService.getDashboard).toHaveBeenCalledTimes(1);
    });

    const dateInputs = screen.getAllByDisplayValue('');
    // Select start date
    fireEvent.change(dateInputs[0], { target: { value: '2026-10-01' } });

    await waitFor(() => {
      expect(adminService.getDashboard).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2026-10-01' })
      );
    });

    // Clear filter
    const clearBtn = screen.getByText('Xóa bộ lọc');
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(adminService.getDashboard).toHaveBeenCalledWith({});
    });
  });

  it('displays error alert when fetch fails', async () => {
    adminService.getDashboard.mockRejectedValue(new Error('Máy chủ gặp sự cố kết nối'));

    render(
      <BrowserRouter>
        <AdminDashboardPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Máy chủ gặp sự cố kết nối/i)).toBeInTheDocument();
    });
  });
});

