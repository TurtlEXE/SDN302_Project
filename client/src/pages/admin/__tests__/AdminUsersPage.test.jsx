import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AdminUsersPage } from '../AdminUsersPage.jsx';
import { adminService } from '../../../services/admin.service.js';

vi.mock('../../../services/admin.service.js', () => ({
  adminService: {
    listUsers: vi.fn(),
    provisionOwner: vi.fn(),
    resendOwnerInvitation: vi.fn(),
    lockUser: vi.fn(),
    unlockUser: vi.fn(),
    resetPassword: vi.fn(),
    updateUser: vi.fn(),
  },
}));

describe('AdminUsersPage Component (P19)', () => {
  const mockUsers = [
    {
      _id: 'u-1',
      id: 'u-1',
      fullName: 'Quản trị viên Hệ thống',
      email: 'admin@platform.com',
      phoneNumber: '0901112222',
      role: 'ADMIN',
      isLocked: false,
      emailVerifiedAt: '2026-10-01T00:00:00Z',
      activatedAt: '2026-10-01T00:00:00Z',
    },
    {
      _id: 'u-2',
      id: 'u-2',
      fullName: 'Chủ sân Chưa Kích Hoạt',
      email: 'newowner@gmail.com',
      phoneNumber: '0903334444',
      role: 'OWNER',
      isLocked: false,
      emailVerifiedAt: null,
      activatedAt: null,
    },
    {
      _id: 'u-3',
      id: 'u-3',
      fullName: 'Khách Hàng Bị Khóa',
      email: 'baduser@gmail.com',
      phoneNumber: '0905556666',
      role: 'CUSTOMER',
      isLocked: true,
      lockReason: 'Spam đặt sân',
      emailVerifiedAt: '2026-10-15T00:00:00Z',
      activatedAt: '2026-10-15T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
  });

  it('renders user list with role badges and statuses', async () => {
    adminService.listUsers.mockResolvedValue({
      success: true,
      data: {
        items: mockUsers,
        pagination: { page: 1, limit: 10, total: 3, totalPages: 1 },
      },
    });

    render(
      <BrowserRouter>
        <AdminUsersPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Quản lý Tài khoản & Phân quyền/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Quản trị viên Hệ thống')).toBeInTheDocument();
      expect(screen.getByText('Chủ sân Chưa Kích Hoạt')).toBeInTheDocument();
      expect(screen.getByText('Khách Hàng Bị Khóa')).toBeInTheDocument();
      expect(screen.getByText('Không thể khóa Admin')).toBeInTheDocument();
      expect(screen.getByText('Gửi lại mời')).toBeInTheDocument();
      expect(screen.getByText('Mở khóa')).toBeInTheDocument();
    });
  });

  it('provisions owner via modal and calls provisionOwner API', async () => {
    adminService.listUsers.mockResolvedValue({
      success: true,
      data: { items: mockUsers, pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } },
    });
    adminService.provisionOwner.mockResolvedValue({
      success: true,
      message: 'Cấp tài khoản chủ sân thành công.',
    });

    render(
      <BrowserRouter>
        <AdminUsersPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('Quản trị viên Hệ thống')).toBeInTheDocument());

    // Open modal
    const openBtn = screen.getByTestId('btn-open-provision-modal');
    fireEvent.click(openBtn);

    expect(screen.getByRole('heading', { name: /Cấp tài khoản Chủ sân \(Owner\)/i })).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn Chủ Sân'), {
      target: { value: 'Nguyễn Văn Chủ Sân Mới' },
    });
    fireEvent.change(screen.getByPlaceholderText('owner@domain.com'), {
      target: { value: 'brandnewowner@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('0912345678'), {
      target: { value: '0912345678' },
    });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Xác nhận cấp Owner/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(adminService.provisionOwner).toHaveBeenCalledWith({
        fullName: 'Nguyễn Văn Chủ Sân Mới',
        email: 'brandnewowner@example.com',
        phoneNumber: '0912345678',
      });
    });
  });

  it('resends invitation for unactivated owner', async () => {
    adminService.listUsers.mockResolvedValue({
      success: true,
      data: { items: mockUsers, pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } },
    });
    adminService.resendOwnerInvitation.mockResolvedValue({
      success: true,
      message: 'Đã gửi lại email mời kích hoạt.',
    });

    render(
      <BrowserRouter>
        <AdminUsersPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('Gửi lại mời')).toBeInTheDocument());

    const resendBtn = screen.getByText('Gửi lại mời');
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(adminService.resendOwnerInvitation).toHaveBeenCalledWith('u-2');
    });
  });

  it('locks a user with mandatory reason', async () => {
    // Return a customer that is currently active
    const activeCustomer = {
      _id: 'u-4',
      id: 'u-4',
      fullName: 'Khách Đang Hoạt Động',
      email: 'customer@gmail.com',
      role: 'CUSTOMER',
      isLocked: false,
    };
    adminService.listUsers.mockResolvedValue({
      success: true,
      data: { items: [activeCustomer], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } },
    });
    adminService.lockUser.mockResolvedValue({
      success: true,
      message: 'Đã khóa tài khoản thành công.',
    });

    render(
      <BrowserRouter>
        <AdminUsersPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('Khách Đang Hoạt Động')).toBeInTheDocument());

    // Click Lock
    const lockBtn = screen.getByRole('button', { name: /Khóa/i });
    fireEvent.click(lockBtn);

    expect(screen.getByText('Xác nhận Khóa tài khoản')).toBeInTheDocument();

    // Fill reason
    const reasonInput = screen.getByPlaceholderText(/Nhập lý do chi tiết/i);
    fireEvent.change(reasonInput, { target: { value: 'Vi phạm quy chế đặt sân' } });

    // Confirm Lock
    const confirmLockBtn = screen.getByRole('button', { name: /Xác nhận khóa/i });
    fireEvent.click(confirmLockBtn);

    await waitFor(() => {
      expect(adminService.lockUser).toHaveBeenCalledWith('u-4', 'Vi phạm quy chế đặt sân');
    });
  });

  it('unlocks a locked user', async () => {
    adminService.listUsers.mockResolvedValue({
      success: true,
      data: { items: mockUsers, pagination: { page: 1, limit: 10, total: 3, totalPages: 1 } },
    });
    adminService.unlockUser.mockResolvedValue({
      success: true,
      message: 'Đã mở khóa tài khoản thành công.',
    });

    render(
      <BrowserRouter>
        <AdminUsersPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('Mở khóa')).toBeInTheDocument());

    const unlockBtn = screen.getByText('Mở khóa');
    fireEvent.click(unlockBtn);

    expect(screen.getByText('Mở khóa tài khoản')).toBeInTheDocument();

    const confirmUnlockBtn = screen.getByRole('button', { name: /Xác nhận mở khóa/i });
    fireEvent.click(confirmUnlockBtn);

    await waitFor(() => {
      expect(adminService.unlockUser).toHaveBeenCalledWith('u-3', 'Quản trị viên mở khóa tài khoản');
    });
  });
});
