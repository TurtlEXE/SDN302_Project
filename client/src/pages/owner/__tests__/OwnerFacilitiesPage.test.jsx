import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OwnerFacilitiesPage } from '../OwnerFacilitiesPage.jsx';
import { ownerService } from '../../../services/owner.service.js';
import { sportService } from '../../../services/sport.service.js';

vi.mock('../../../services/owner.service.js', () => ({
  ownerService: {
    listFacilities: vi.fn(),
    createFacility: vi.fn(),
    getFacilityById: vi.fn(),
    updateFacility: vi.fn(),
    uploadFacilityImage: vi.fn(),
    deleteFacilityImage: vi.fn(),
    setCoverImage: vi.fn(),
    listFacilitySports: vi.fn(),
    addFacilitySport: vi.fn(),
    updateFacilitySportStep: vi.fn(),
    listCourts: vi.fn(),
    createCourt: vi.fn(),
    updateCourt: vi.fn(),
  },
}));

vi.mock('../../../services/sport.service.js', () => ({
  sportService: {
    getPublicSports: vi.fn(),
  },
}));

describe('OwnerFacilitiesPage Component (P18)', () => {
  const mockFacilities = [
    {
      _id: 'f-1',
      id: 'f-1',
      name: 'CLB Cầu Lông & Bóng Đá Sao Vàng',
      address: 'Số 123 Đường Cầu Giấy, Hà Nội',
      province: 'Hà Nội',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      phoneNumber: '0912345678',
      description: 'Cơ sở thể thao hiện đại',
      images: [],
    },
  ];

  const mockFacilitySports = [
    {
      _id: 'fs-1',
      id: 'fs-1',
      sportId: { _id: 'sp-1', id: 'sp-1', name: 'Bóng đá' },
      sportName: 'Bóng đá',
      slotStepMinutes: 60,
      configVersion: 1,
    },
  ];

  const mockCourts = [
    {
      _id: 'c-1',
      id: 'c-1',
      name: 'Sân bóng số 1',
      facilitySportId: 'fs-1',
      sportName: 'Bóng đá',
      pricePerHourVnd: 300000,
      isActive: true,
      description: 'Sân cỏ nhân tạo',
    },
  ];

  const mockAllSports = [
    { _id: 'sp-1', id: 'sp-1', name: 'Bóng đá' },
    { _id: 'sp-2', id: 'sp-2', name: 'Cầu lông' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    sportService.getPublicSports.mockResolvedValue({
      data: mockAllSports,
    });
  });

  it('renders facilities list and switches to detail view on click', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.getFacilityById.mockResolvedValue({
      data: mockFacilities[0],
    });
    ownerService.listFacilitySports.mockResolvedValue({
      data: mockFacilitySports,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });

    render(
      <BrowserRouter>
        <OwnerFacilitiesPage />
      </BrowserRouter>
    );

    // Initial facilities grid
    await waitFor(() => {
      expect(
        screen.getByText('CLB Cầu Lông & Bóng Đá Sao Vàng')
      ).toBeInTheDocument();
    });

    // Click on facility card to open detail / sub-tabs
    fireEvent.click(screen.getByTestId('btn-manage-f-1'));

    await waitFor(() => {
      // Sub tabs are visible
      expect(screen.getByText('Thông tin chung')).toBeInTheDocument();
      expect(screen.getByText(/Hình ảnh/)).toBeInTheDocument();
      expect(screen.getByTestId('subtab-sports')).toBeInTheDocument();
      expect(screen.getByTestId('subtab-courts')).toBeInTheDocument();
    });
  });

  it('allows editing facility info and pausing/publishing status (Defect 1)', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.getFacilityById.mockResolvedValue({
      data: mockFacilities[0],
    });
    ownerService.listFacilitySports.mockResolvedValue({
      data: mockFacilitySports,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });
    ownerService.updateFacility.mockResolvedValue({
      data: { ...mockFacilities[0], status: 'PAUSED' },
    });

    render(
      <BrowserRouter>
        <OwnerFacilitiesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CLB Cầu Lông & Bóng Đá Sao Vàng')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-manage-f-1'));

    // Verify Pause button is available on published facility
    await waitFor(() => {
      expect(screen.getByTestId('btn-pause-facility')).toBeInTheDocument();
    });

    // Click pause
    fireEvent.click(screen.getByTestId('btn-pause-facility'));
    await waitFor(() => {
      expect(ownerService.updateFacility).toHaveBeenCalledWith('f-1', { status: 'PAUSED' });
    });

    // Click Edit Facility Info
    const editBtn = screen.getByTestId('btn-edit-facility');
    fireEvent.click(editBtn);

    // Form inputs should be visible and editable
    const nameInput = screen.getByTestId('input-edit-facility-name');
    expect(nameInput).toBeInTheDocument();
    fireEvent.change(nameInput, { target: { value: 'CLB Sao Vàng Đổi Tên' } });

    // Save
    const saveBtn = screen.getByTestId('btn-save-facility-info');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(ownerService.updateFacility).toHaveBeenCalledWith(
        'f-1',
        expect.objectContaining({ name: 'CLB Sao Vàng Đổi Tên' })
      );
    });
  });

  it('allows switching to Sports tab, viewing slot preview and updating step (Defect 3)', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.getFacilityById.mockResolvedValue({
      data: mockFacilities[0],
    });
    ownerService.listFacilitySports.mockResolvedValue({
      data: mockFacilitySports,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });
    ownerService.updateFacilitySportStep.mockResolvedValue({
      data: { ...mockFacilitySports[0], slotStepMinutes: 90 },
    });

    render(
      <BrowserRouter>
        <OwnerFacilitiesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CLB Cầu Lông & Bóng Đá Sao Vàng')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-manage-f-1'));

    await waitFor(() => {
      expect(screen.getByTestId('subtab-sports')).toBeInTheDocument();
    });

    // Click Sports tab
    fireEvent.click(screen.getByTestId('subtab-sports'));

    await waitFor(() => {
      expect(screen.getByText('Bước giờ ô lịch')).toBeInTheDocument();
      expect(screen.getByText('30 phút / slot')).toBeInTheDocument();
      expect(screen.getByText('60 phút / slot')).toBeInTheDocument();
      expect(screen.getByText('90 phút / slot')).toBeInTheDocument();
      expect(screen.getAllByText('Bóng đá').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/60 phút\/ô/)).toBeInTheDocument();
      expect(screen.getByTestId('btn-change-step-fs-1')).toBeInTheDocument();
    });

    // Open change step modal
    fireEvent.click(screen.getByTestId('btn-change-step-fs-1'));

    await waitFor(() => {
      expect(screen.getByText('Thay đổi bước giờ ô lịch')).toBeInTheDocument();
      expect(screen.getByTestId('select-change-step')).toBeInTheDocument();
    });

    // Select 90 min step and observe live preview
    fireEvent.change(screen.getByTestId('select-change-step'), { target: { value: '90' } });

    // Confirm step change
    fireEvent.click(screen.getByTestId('btn-confirm-change-step'));

    await waitFor(() => {
      expect(ownerService.updateFacilitySportStep).toHaveBeenCalledWith('f-1', 'fs-1', {
        slotStepMinutes: 90,
      });
    });
  });

  it('displays conflict warning when step change is blocked by active schedules (Criterion 15)', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.getFacilityById.mockResolvedValue({
      data: mockFacilities[0],
    });
    ownerService.listFacilitySports.mockResolvedValue({
      data: mockFacilitySports,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });
    ownerService.updateFacilitySportStep.mockRejectedValue({
      response: {
        data: {
          errorCode: 'FACILITY_HAS_ACTIVE_BOOKINGS',
          message: 'Không thể thay đổi bước giờ vì nhóm môn đang có đơn đặt hoặc lịch khóa chưa kết thúc.',
        },
      },
    });

    render(
      <BrowserRouter>
        <OwnerFacilitiesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CLB Cầu Lông & Bóng Đá Sao Vàng')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-manage-f-1'));

    await waitFor(() => {
      expect(screen.getByTestId('subtab-sports')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('subtab-sports'));

    await waitFor(() => {
      expect(screen.getByTestId('btn-change-step-fs-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-change-step-fs-1'));
    fireEvent.click(screen.getByTestId('btn-confirm-change-step'));

    // Check warning message and quick links appear
    await waitFor(() => {
      expect(screen.getByText(/Cản trở thay đổi cấu hình \(Tiêu chí 15\)/)).toBeInTheDocument();
      expect(screen.getByText(/Kiểm tra đơn đặt sân/)).toBeInTheDocument();
      expect(screen.getByText(/Kiểm tra lịch khóa sân/)).toBeInTheDocument();
    });
  });

  it('allows editing court name, price and toggling active status (Defect 2 & OWN-05)', async () => {
    ownerService.listFacilities.mockResolvedValue({
      data: mockFacilities,
    });
    ownerService.getFacilityById.mockResolvedValue({
      data: mockFacilities[0],
    });
    ownerService.listFacilitySports.mockResolvedValue({
      data: mockFacilitySports,
    });
    ownerService.listCourts.mockResolvedValue({
      data: mockCourts,
    });
    ownerService.updateCourt.mockResolvedValue({
      data: { ...mockCourts[0], pricePerHourVnd: 350000 },
    });

    render(
      <BrowserRouter>
        <OwnerFacilitiesPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CLB Cầu Lông & Bóng Đá Sao Vàng')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('btn-manage-f-1'));

    await waitFor(() => {
      expect(screen.getByTestId('subtab-courts')).toBeInTheDocument();
    });

    // Click Courts tab
    fireEvent.click(screen.getByTestId('subtab-courts'));

    await waitFor(() => {
      expect(screen.getByTestId('court-card-c-1')).toBeInTheDocument();
      expect(screen.getByTestId('btn-edit-court-c-1')).toBeInTheDocument();
      expect(screen.getByTestId('btn-toggle-court-c-1')).toBeInTheDocument();
    });

    // Test quick toggle
    fireEvent.click(screen.getByTestId('btn-toggle-court-c-1'));
    await waitFor(() => {
      expect(ownerService.updateCourt).toHaveBeenCalledWith('c-1', { isActive: false });
    });

    // Test edit court modal
    fireEvent.click(screen.getByTestId('btn-edit-court-c-1'));

    await waitFor(() => {
      expect(screen.getByText('Chỉnh sửa sân thi đấu')).toBeInTheDocument();
      expect(screen.getByText(/Quy tắc bảo lưu giá cũ \(OWN-05\):/)).toBeInTheDocument();
    });

    // Change price
    const priceInput = screen.getByTestId('input-edit-court-price');
    fireEvent.change(priceInput, { target: { value: '350000' } });

    // Submit
    fireEvent.click(screen.getByTestId('btn-save-court'));

    await waitFor(() => {
      expect(ownerService.updateCourt).toHaveBeenCalledWith(
        'c-1',
        expect.objectContaining({ pricePerHourVnd: 350000 })
      );
    });
  });
});
