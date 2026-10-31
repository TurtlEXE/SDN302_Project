import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OwnerCourtBlocksPage } from '../OwnerCourtBlocksPage.jsx';
import { ownerService } from '../../../services/owner.service.js';
import { courtService } from '../../../services/court.service.js';

vi.mock('../../../services/owner.service.js', () => ({
  ownerService: {
    listFacilities: vi.fn(),
    listCourts: vi.fn(),
    listCourtBlocks: vi.fn(),
    createCourtBlock: vi.fn(),
    deleteCourtBlock: vi.fn(),
  },
}));

vi.mock('../../../services/court.service.js', () => ({
  courtService: {
    getCourtSchedule: vi.fn(),
  },
}));

describe('OwnerCourtBlocksPage Component (P18)', () => {
  const mockFacilities = [
    { id: 'f-1', _id: 'f-1', name: 'CLB Sao Vàng' },
  ];

  const mockCourts = [
    { id: 'c-1', _id: 'c-1', name: 'Sân 1', facilityId: 'f-1' },
  ];

  const mockSchedule = {
    courtId: 'c-1',
    date: '2026-11-01',
    slotStepMinutes: 60,
    configVersion: 1,
    slots: [
      { startTime: '06:00', endTime: '07:00', status: 'AVAILABLE' },
      { startTime: '07:00', endTime: '08:00', status: 'AVAILABLE' },
      { startTime: '08:00', endTime: '09:00', status: 'BOOKED' },
    ],
  };

  const mockBlocks = [
    {
      id: 'cb-1',
      _id: 'cb-1',
      courtId: 'c-1',
      bookingDate: '2026-11-01',
      startTime: '14:00',
      endTime: '16:00',
      reason: 'Bảo trì dàn đèn',
      isActive: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders court blocks and slot selector', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });
    courtService.getCourtSchedule.mockResolvedValue({
      data: mockSchedule,
    });
    ownerService.listCourtBlocks.mockResolvedValue({
      data: mockBlocks,
    });

    render(
      <BrowserRouter>
        <OwnerCourtBlocksPage />
      </BrowserRouter>
    );

    // Header & rule notice
    expect(screen.getByText('Quản lý khóa lịch sân (Bảo trì & Sự cố)')).toBeInTheDocument();
    expect(screen.getByText(/Quy tắc bảo vệ lịch:/)).toBeInTheDocument();

    // Table of blocks
    await waitFor(() => {
      expect(screen.getByText('Bảo trì dàn đèn')).toBeInTheDocument();
      expect(screen.getByText('14:00 - 16:00')).toBeInTheDocument();
      expect(screen.getByText('Đang khóa')).toBeInTheDocument();
    });

    // Slots are rendered
    await waitFor(() => {
      expect(screen.getByText('06:00')).toBeInTheDocument();
      const sevenOclockElements = screen.getAllByText('07:00');
      expect(sevenOclockElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('submits a new court block when slots and reason are selected', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });
    courtService.getCourtSchedule.mockResolvedValue({
      data: mockSchedule,
    });
    ownerService.listCourtBlocks.mockResolvedValue({
      data: [],
    });
    ownerService.createCourtBlock.mockResolvedValue({ success: true });

    render(
      <BrowserRouter>
        <OwnerCourtBlocksPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('06:00')).toBeInTheDocument();
    });

    // Click slot 06:00
    fireEvent.click(screen.getByText('06:00'));

    // Input reason
    const reasonInput = screen.getByPlaceholderText(/Bảo trì cỏ nhân tạo/i);
    fireEvent.change(reasonInput, { target: { value: 'Sửa khung lưới' } });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Xác nhận khóa lịch sân/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ownerService.createCourtBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          courtId: 'c-1',
          selectedSlots: [{ startTime: '06:00', endTime: '07:00' }],
          reason: 'Sửa khung lưới',
        })
      );
    });
  });
});
