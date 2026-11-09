import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OwnerSchedulePage } from '../OwnerSchedulePage.jsx';
import { ownerService } from '../../../services/owner.service.js';
import { facilityService } from '../../../services/facility.service.js';

vi.mock('../../../services/owner.service.js', () => ({
  ownerService: {
    listFacilities: vi.fn(),
    createOnBehalfBooking: vi.fn(),
    createCourtBlock: vi.fn(),
    completeBooking: vi.fn(),
    markNoShowBooking: vi.fn(),
  },
}));

vi.mock('../../../services/facility.service.js', () => ({
  facilityService: {
    getFacilitySchedule: vi.fn(),
  },
}));

describe('OwnerSchedulePage Component (Interactive Full-Court Calendar)', () => {
  const mockFacilities = [
    { id: 'f-1', _id: 'f-1', name: 'CLB Cầu Lông Ba Đình', province: 'Hà Nội' },
  ];

  const mockFacilitySchedule = {
    facilityId: 'f-1',
    facilityName: 'CLB Cầu Lông Ba Đình',
    bookingDate: '2026-11-10',
    dayType: 'WEEKDAY',
    isOpen: true,
    operatingHoursVersion: 1,
    sports: [
      {
        facilitySportId: 'fs-1',
        sportId: 'sp-1',
        sportName: 'Cầu Lông',
        slotStepMinutes: 30,
        configVersion: 1,
        courts: [
          {
            courtId: 'c-1',
            courtName: 'Sân 1',
            pricePerHourVnd: 100000,
            priceVersion: 1,
            slots: [
              {
                startTime: '06:00',
                endTime: '06:30',
                status: 'AVAILABLE',
                priceVnd: 50000,
              },
              {
                startTime: '06:30',
                endTime: '07:00',
                status: 'AVAILABLE',
                priceVnd: 50000,
              },
              {
                startTime: '07:00',
                endTime: '07:30',
                status: 'BOOKED',
                priceVnd: 50000,
                booking: {
                  id: 'bk-1',
                  bookingCode: 'BK-TEST-001',
                  status: 'CONFIRMED',
                  customerName: 'Nguyễn Văn Test',
                  customerPhone: '0901234567',
                  customerEmail: 'test@sportbooking.local',
                  startTime: '07:00',
                  endTime: '08:00',
                  totalPriceVnd: 100000,
                },
              },
              {
                startTime: '07:30',
                endTime: '08:00',
                status: 'BLOCKED',
                priceVnd: 50000,
                block: {
                  id: 'blk-1',
                  reason: 'Bảo trì lưới',
                  startTime: '07:30',
                  endTime: '08:00',
                },
              },
            ],
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    facilityService.getFacilitySchedule.mockResolvedValue({
      data: mockFacilitySchedule,
    });
  });

  it('renders facility schedule matrix with courts and slots', async () => {
    render(
      <BrowserRouter>
        <OwnerSchedulePage />
      </BrowserRouter>
    );

    expect(screen.getByTestId('owner-schedule-page')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Lịch Sân Trực Quan (Full-Court Matrix)')).toBeInTheDocument();
      expect(screen.getByText('Sân 1')).toBeInTheDocument();
      expect(screen.getAllByText('Cầu Lông').length).toBeGreaterThan(0);
      expect(screen.getByText('Nguyễn Văn Test')).toBeInTheDocument();
    });
  });

  it('opens booking detail modal when clicking a booked slot and can mark completed', async () => {
    ownerService.completeBooking.mockResolvedValue({ success: true });

    render(
      <BrowserRouter>
        <OwnerSchedulePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn Test')).toBeInTheDocument();
    });

    // Click booked slot
    fireEvent.click(screen.getByText('Nguyễn Văn Test'));

    // Modal opens with booking code and details
    expect(screen.getByText('Chi tiết đơn đặt sân')).toBeInTheDocument();
    expect(screen.getByText('BK-TEST-001')).toBeInTheDocument();
    expect(screen.getAllByText('0901234567').length).toBeGreaterThan(0);

    // Click complete button
    const completeBtn = screen.getByText('Check-in / Hoàn tất');
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(ownerService.completeBooking).toHaveBeenCalledWith('bk-1');
    });
  });

  it('selects available slots and shows bottom action bar for on-behalf booking', async () => {
    render(
      <BrowserRouter>
        <OwnerSchedulePage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sân 1')).toBeInTheDocument();
    });

    // Click available slot (price text 50.000 đ)
    const availSlots = screen.getAllByText(/50\.000/);
    fireEvent.click(availSlots[0]);

    // Bottom bar appears
    await waitFor(() => {
      expect(screen.getByText(/Đang chọn: Sân 1/)).toBeInTheDocument();
      expect(screen.getByText('Đặt sân hộ tại quầy')).toBeInTheDocument();
    });

    // Click on-behalf button opens modal
    fireEvent.click(screen.getByText('Đặt sân hộ tại quầy'));

    expect(screen.getByText('Đặt sân hộ cho khách vãng lai')).toBeInTheDocument();
  });
});
