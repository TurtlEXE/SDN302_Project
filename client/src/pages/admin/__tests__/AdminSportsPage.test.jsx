import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminSportsPage } from '../AdminSportsPage.jsx';
import { adminService } from '../../../services/admin.service.js';

vi.mock('../../../services/admin.service.js', () => ({
  adminService: {
    listSports: vi.fn(),
    createSport: vi.fn(),
    updateSport: vi.fn(),
    deleteSport: vi.fn(),
  },
}));

describe('AdminSportsPage Component (P19)', () => {
  const mockSports = [
    {
      _id: 's-1',
      id: 's-1',
      name: 'Bóng đá mini',
      normalizedName: 'BÓNG ĐÁ MINI',
      description: 'Sân cỏ nhân tạo 5 người và 7 người',
      isActive: true,
    },
    {
      _id: 's-2',
      id: 's-2',
      name: 'Cầu lông',
      normalizedName: 'CẦU LÔNG',
      description: 'Sân thảm tiêu chuẩn BWF',
      isActive: true,
    },
    {
      _id: 's-3',
      id: 's-3',
      name: 'Bóng bàn',
      normalizedName: 'BÓNG BÀN',
      description: 'Tạm ngưng phục vụ bảo trì',
      isActive: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  it('renders sports list with normalized names and active badges', async () => {
    adminService.listSports.mockResolvedValue({
      success: true,
      data: {
        items: mockSports,
        pagination: { page: 1, limit: 10, total: 3, totalPages: 1 },
      },
    });

    render(
      <BrowserRouter>
        <AdminSportsPage />
      </BrowserRouter>
    );

    expect(screen.getByRole('heading', { name: /Danh mục Môn Thể thao/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Bóng đá mini')).toBeInTheDocument();
      expect(screen.getByText('BÓNG ĐÁ MINI')).toBeInTheDocument();
      expect(screen.getByText('Cầu lông')).toBeInTheDocument();
      expect(screen.getByText('Bóng bàn')).toBeInTheDocument();
      expect(screen.getAllByText('Tạm dừng').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('adds a new sport through modal form', async () => {
    adminService.listSports.mockResolvedValue({
      success: true,
      data: { items: mockSports, pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } },
    });
    adminService.createSport.mockResolvedValue({
      success: true,
      message: 'Thêm môn thể thao mới thành công.',
    });

    render(
      <BrowserRouter>
        <AdminSportsPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('Bóng đá mini')).toBeInTheDocument());

    const openBtn = screen.getByTestId('btn-open-add-sport-modal');
    fireEvent.click(openBtn);

    expect(screen.getByText('Thêm Môn Thể thao mới')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByPlaceholderText(/Ví dụ: Cầu lông, Bóng đá mini/i), {
      target: { value: 'Pickleball' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Thông tin quy chuẩn/i), {
      target: { value: 'Môn thể thao mới nổi rất phổ biến' },
    });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Tạo môn thể thao/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(adminService.createSport).toHaveBeenCalledWith({
        name: 'Pickleball',
        description: 'Môn thể thao mới nổi rất phổ biến',
      });
    });
  });

  it('edits sport and toggles active state', async () => {
    adminService.listSports.mockResolvedValue({
      success: true,
      data: { items: mockSports, pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } },
    });
    adminService.updateSport.mockResolvedValue({
      success: true,
      message: 'Cập nhật môn thể thao thành công.',
    });

    render(
      <BrowserRouter>
        <AdminSportsPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('Bóng đá mini')).toBeInTheDocument());

    const editBtns = screen.getAllByTitle('Chỉnh sửa môn thể thao');
    fireEvent.click(editBtns[0]); // Click edit on "Bóng đá mini"

    expect(screen.getByText('Chỉnh sửa Môn Thể thao')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Lưu cập nhật/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(adminService.updateSport).toHaveBeenCalledWith(
        's-1',
        expect.objectContaining({
          name: 'Bóng đá mini',
          isActive: true,
        })
      );
    });
  });

  it('confirms and deletes a sport', async () => {
    adminService.listSports.mockResolvedValue({
      success: true,
      data: { items: mockSports, pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } },
    });
    adminService.deleteSport.mockResolvedValue({
      success: true,
      message: 'Đã xóa môn thể thao thành công.',
    });

    render(
      <BrowserRouter>
        <AdminSportsPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('Bóng bàn')).toBeInTheDocument());

    const deleteBtns = screen.getAllByTitle(/Xóa môn thể thao/i);
    fireEvent.click(deleteBtns[2]); // Click delete on "Bóng bàn"

    expect(screen.getByText('Xác nhận Xóa Môn Thể thao')).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole('button', { name: /Xác nhận xóa/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(adminService.deleteSport).toHaveBeenCalledWith('s-3');
    });
  });
});
