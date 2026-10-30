import React, { useEffect, useState, useCallback } from 'react';
import {
  Mail,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { adminService } from '../../services/admin.service.js';

export function AdminEmailOutboxPage() {
  const [messages, setMessages] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Retry action loading id
  const [retryingId, setRetryingId] = useState(null);

  // Detail Modal
  const [viewTargetMessage, setViewTargetMessage] = useState(null);

  const fetchOutbox = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);
        const params = { page, limit: pagination.limit };
        if (statusFilter) params.status = statusFilter;

        const res = await adminService.listEmailOutbox(params);
        if (res?.data) {
          setMessages(res.data || []);
          if (res.pagination) {
            setPagination(res.pagination);
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Không thể tải danh sách hộp thư Email Outbox.');
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit, statusFilter]
  );

  useEffect(() => {
    fetchOutbox(1);
  }, [fetchOutbox]);

  const handleRetrySingle = async (msg) => {
    const msgId = msg.id || msg._id;
    try {
      setRetryingId(msgId);
      const res = await adminService.retryEmail(msgId);
      setSuccessMsg(res?.message || 'Đã kích hoạt thử lại gửi email thành công.');
      fetchOutbox(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể kích hoạt thử lại email.');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="admin-email-outbox-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Hộp thư Email Outbox & Giám sát Lỗi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi trạng thái gửi email xác thực, mời kích hoạt, thông báo đơn và kích hoạt gửi lại khi gặp lỗi mạng
            (ADM-07, Criterion 43).
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchOutbox(pagination.page)}
          disabled={loading}
          className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Lọc theo trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="FAILED">Gửi thất bại (FAILED)</option>
            <option value="PENDING">Chờ gửi (PENDING)</option>
            <option value="PROCESSING">Đang xử lý (PROCESSING)</option>
            <option value="SENT">Đã gửi thành công (SENT)</option>
          </select>
        </div>

        <span className="text-xs text-slate-500">
          Tổng cộng: <strong>{pagination.total}</strong> sự kiện email
        </span>
      </div>

      {/* Outbox Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Loại sự kiện & Mã</th>
                <th className="py-3 px-4">Người nhận</th>
                <th className="py-3 px-4">Tiêu đề email</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Lần thử</th>
                <th className="py-3 px-4">Lỗi gần nhất</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && messages.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                    Đang tải danh sách email outbox...
                  </td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    Không có email nào trong Outbox phù hợp tiêu chí lọc.
                  </td>
                </tr>
              ) : (
                messages.map((m) => {
                  const mid = m.id || m._id;
                  const isRetrying = retryingId === mid;
                  const isFailed = m.status === 'FAILED';
                  const isSent = m.status === 'SENT';

                  return (
                    <tr key={mid} className="hover:bg-slate-50/70 transition">
                      {/* Event Type & Key */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-xs">{m.eventType}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[180px]" title={m.eventKey}>
                            {m.eventKey}
                          </span>
                        </div>
                      </td>

                      {/* Recipient */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{m.recipientName || '—'}</span>
                          <span className="text-[11px] text-slate-500">{m.recipientEmail}</span>
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="py-3.5 px-4 max-w-xs truncate font-medium text-slate-700" title={m.subject}>
                        {m.subject}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isSent && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã gửi</span>
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>Thất bại</span>
                          </span>
                        )}
                        {m.status === 'PENDING' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Chờ gửi</span>
                          </span>
                        )}
                        {m.status === 'PROCESSING' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Đang gửi</span>
                          </span>
                        )}
                      </td>

                      {/* Attempts */}
                      <td className="py-3.5 px-4 font-mono text-slate-700 text-xs">
                        <span className={m.attempts >= m.maxAttempts ? 'text-rose-600 font-bold' : ''}>
                          {m.attempts} / {m.maxAttempts || 3}
                        </span>
                      </td>

                      {/* Last Error */}
                      <td className="py-3.5 px-4 max-w-xs truncate text-[11px] text-rose-600" title={m.lastError || ''}>
                        {m.lastError ? m.lastError : <span className="text-slate-400 italic">Không có lỗi</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center space-x-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setViewTargetMessage(m)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="Xem chi tiết sự kiện"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Retry button */}
                          {!isSent && (
                            <button
                              type="button"
                              onClick={() => handleRetrySingle(m)}
                              disabled={isRetrying}
                              className="px-2.5 py-1 text-[11px] font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition inline-flex items-center space-x-1"
                              title="Thử lại gửi email này"
                            >
                              <Send className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                              <span>{isRetrying ? 'Đang gửi...' : 'Gửi lại'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages}</strong> (Tổng{' '}
              {pagination.total} email)
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => fetchOutbox(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => fetchOutbox(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL: Xem chi tiết sự kiện Outbox */}
      {viewTargetMessage && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl border border-slate-200 animate-scaleIn space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-slate-800">
                <Mail className="w-5 h-5 text-brand-600" />
                <h2 className="text-base font-bold">Chi tiết Email Outbox</h2>
              </div>
              <button
                type="button"
                onClick={() => setViewTargetMessage(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Mã sự kiện (Event Key):</span>
                <span className="font-mono text-slate-800 font-semibold">{viewTargetMessage.eventKey}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Loại sự kiện (Event Type):</span>
                <span className="font-bold text-slate-800">{viewTargetMessage.eventType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Người nhận:</span>
                <span className="text-slate-800 font-medium">
                  {viewTargetMessage.recipientName} ({viewTargetMessage.recipientEmail})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Tiêu đề:</span>
                <span className="text-slate-800 font-medium">{viewTargetMessage.subject}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Trạng thái:</span>
                <span className="font-bold">{viewTargetMessage.status}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Số lần thử:</span>
                <span className="font-mono">{viewTargetMessage.attempts} / {viewTargetMessage.maxAttempts || 3}</span>
              </div>
              {viewTargetMessage.lastAttemptAt && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Lần thử gần nhất:</span>
                  <span className="text-slate-700">
                    {new Date(viewTargetMessage.lastAttemptAt).toLocaleString('vi-VN')}
                  </span>
                </div>
              )}
              {viewTargetMessage.lastError && (
                <div className="py-2">
                  <span className="text-rose-600 font-bold block mb-1">Chi tiết lỗi:</span>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-mono text-[11px] whitespace-pre-wrap break-all">
                    {viewTargetMessage.lastError}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Bảo mật danh tính:</strong> Không lưu hoặc hiển thị token xác thực và mật khẩu thô trong nhật ký
                (ADM-07, Criterion 43).
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setViewTargetMessage(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminEmailOutboxPage;

