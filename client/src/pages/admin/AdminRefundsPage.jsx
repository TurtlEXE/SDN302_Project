import React, { useEffect, useState, useCallback } from 'react';
import {
  Receipt,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  CreditCard,
  Ban,
  UploadCloud,
} from 'lucide-react';
import { adminService } from '../../services/admin.service.js';
import { formatVND } from '../../utils/slot-helper.js';

export function AdminRefundsPage() {
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'exceptions'

  // Tab 1: Refund Cases
  const [refundCases, setRefundCases] = useState([]);
  const [casesPagination, setCasesPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [caseStatusFilter, setCaseStatusFilter] = useState('');
  const [loadingCases, setLoadingCases] = useState(true);

  // Tab 2: Payment Transactions & Exceptions
  const [transactions, setTransactions] = useState([]);
  const [txnsPagination, setTxnsPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [onlyExceptions, setOnlyExceptions] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(false);

  // Notifications
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modals state
  // Modal A: Record Manual Refund Execution (ADM-05, Section 8.7, Criterion 54)
  const [recordRefundTarget, setRecordRefundTarget] = useState(null);
  const [recordForm, setRecordForm] = useState({ proofReference: '', proofImageUrl: '' });
  const [submittingRecord, setSubmittingRecord] = useState(false);

  // Modal B: Admin Cancel & Refund Booking (Section 8.7, Criteria 13, 53)
  const [showCancelBookingModal, setShowCancelBookingModal] = useState(false);
  const [cancelForm, setCancelForm] = useState({ bookingId: '', reason: '' });
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Modal C: Create Exception Refund (Criterion 49, 55)
  const [exceptionTargetTxn, setExceptionTargetTxn] = useState(null);
  const [exceptionRefundReason, setExceptionRefundReason] = useState('');
  const [submittingExceptionRefund, setSubmittingExceptionRefund] = useState(false);

  // Load Tab 1: Refund Cases
  const fetchRefundCases = useCallback(
    async (page = 1) => {
      try {
        setLoadingCases(true);
        setError(null);
        const params = { page, limit: casesPagination.limit };
        if (caseStatusFilter) params.status = caseStatusFilter;

        const res = await adminService.listRefundCases(params);
        if (res?.data) {
          setRefundCases(res.data || []);
          if (res.pagination) {
            setCasesPagination(res.pagination);
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Không thể tải danh sách hồ sơ hoàn tiền.');
      } finally {
        setLoadingCases(false);
      }
    },
    [casesPagination.limit, caseStatusFilter]
  );

  // Load Tab 2: Transactions
  const fetchTransactions = useCallback(
    async (page = 1) => {
      try {
        setLoadingTxns(true);
        setError(null);
        const params = { page, limit: txnsPagination.limit };
        if (onlyExceptions) params.hasException = 'true';

        const res = await adminService.listPaymentTransactions(params);
        if (res?.data) {
          setTransactions(res.data || []);
          if (res.pagination) {
            setTxnsPagination(res.pagination);
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Không thể tải danh sách giao dịch.');
      } finally {
        setLoadingTxns(false);
      }
    },
    [txnsPagination.limit, onlyExceptions]
  );

  useEffect(() => {
    if (activeTab === 'cases') {
      fetchRefundCases(1);
    } else {
      fetchTransactions(1);
    }
  }, [activeTab, fetchRefundCases, fetchTransactions]);

  // Submit Modal A: Record Manual Refund
  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    if (!recordForm.proofReference.trim()) {
      alert('Mã chứng từ / Mã giao dịch ngân hàng là bắt buộc để ghi nhận hoàn tiền thực tế.');
      return;
    }
    try {
      setSubmittingRecord(true);
      const caseId = recordRefundTarget.id || recordRefundTarget._id;
      const res = await adminService.recordManualRefund(caseId, {
        proofReference: recordForm.proofReference.trim(),
        proofImageUrl: recordForm.proofImageUrl.trim() || undefined,
      });
      setSuccessMsg(res?.message || 'Ghi nhận hoàn tiền thực tế thành công. Hồ sơ đã chuyển sang REFUNDED.');
      setRecordRefundTarget(null);
      setRecordForm({ proofReference: '', proofImageUrl: '' });
      fetchRefundCases(casesPagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể ghi nhận hoàn tiền.');
    } finally {
      setSubmittingRecord(false);
    }
  };

  // Submit Modal B: Admin Cancel & Refund Booking
  const handleCancelBookingSubmit = async (e) => {
    e.preventDefault();
    if (!cancelForm.bookingId.trim() || !cancelForm.reason.trim()) {
      alert('Vui lòng nhập ID đơn đặt sân và lý do hủy.');
      return;
    }
    try {
      setSubmittingCancel(true);
      const res = await adminService.cancelAndRefundBooking(
        cancelForm.bookingId.trim(),
        cancelForm.reason.trim()
      );
      setSuccessMsg(res?.message || 'Hủy Booking thành công, đã nhả lịch sân và tạo hồ sơ hoàn tiền PENDING.');
      setShowCancelBookingModal(false);
      setCancelForm({ bookingId: '', reason: '' });
      fetchRefundCases(1);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi thực hiện hủy đơn.');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Submit Modal C: Create Exception Refund
  const handleExceptionRefundSubmit = async (e) => {
    e.preventDefault();
    if (!exceptionRefundReason.trim()) {
      alert('Lý do hoàn ngoại lệ là bắt buộc.');
      return;
    }
    try {
      setSubmittingExceptionRefund(true);
      const txnId = exceptionTargetTxn.id || exceptionTargetTxn._id;
      const res = await adminService.createExceptionRefund({
        paymentTransactionId: txnId,
        reason: exceptionRefundReason.trim(),
      });
      setSuccessMsg(res?.message || 'Đã tạo hồ sơ hoàn tiền cho giao dịch ngoại lệ thành công.');
      setExceptionTargetTxn(null);
      setExceptionRefundReason('');
      setActiveTab('cases');
      fetchRefundCases(1);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tạo hồ sơ hoàn ngoại lệ.');
    } finally {
      setSubmittingExceptionRefund(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="admin-refunds-page">
      {/* Header & Quick Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Hồ sơ Hoàn tiền & Giao dịch Ngoại lệ
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Ghi nhận chứng từ hoàn tiền thực tế, hủy Booking do cơ sở không phục vụ và xử lý giao dịch muộn / sai tiền
            (Section 8.7, Criteria 13, 49, 53, 54, 55).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCancelBookingModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-sm w-fit"
          data-testid="btn-open-cancel-modal"
        >
          <Ban className="w-4 h-4" />
          <span>Hỗ trợ hủy & hoàn Booking</span>
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

      {/* Tab Switcher */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('cases')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition flex items-center space-x-2 ${
            activeTab === 'cases'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          data-testid="tab-refund-cases"
        >
          <Receipt className="w-4 h-4" />
          <span>Hồ sơ hoàn tiền (Refund Cases)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('exceptions')}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl transition flex items-center space-x-2 ${
            activeTab === 'exceptions'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          data-testid="tab-payment-exceptions"
        >
          <CreditCard className="w-4 h-4" />
          <span>Giao dịch Ngoại lệ & Đối soát</span>
        </button>
      </div>

      {/* TAB 1 CONTENT: Refund Cases */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-600">Trạng thái hồ sơ:</span>
              <select
                value={caseStatusFilter}
                onChange={(e) => setCaseStatusFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">Chờ hoàn tiền (PENDING)</option>
                <option value="REFUNDED">Đã hoàn tiền (REFUNDED)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => fetchRefundCases(casesPagination.page)}
              className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition"
              title="Tải lại"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCases ? 'animate-spin text-brand-600' : ''}`} />
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Mã hồ sơ</th>
                    <th className="py-3 px-4">Mã Đơn / Giao dịch</th>
                    <th className="py-3 px-4">Số tiền hoàn</th>
                    <th className="py-3 px-4">Lý do hoàn</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Chứng từ hoàn tiền</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingCases && refundCases.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                        Đang tải danh sách hồ sơ hoàn tiền...
                      </td>
                    </tr>
                  ) : refundCases.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">
                        Không có hồ sơ hoàn tiền nào.
                      </td>
                    </tr>
                  ) : (
                    refundCases.map((rc) => {
                      const rcid = rc.id || rc._id;
                      const isPending = rc.status === 'PENDING';

                      return (
                        <tr key={rcid} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{rc.refundCaseCode}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-700">
                            {rc.bookingCode ? (
                              <span className="font-semibold text-brand-600">{rc.bookingCode}</span>
                            ) : rc.paymentTransactionId ? (
                              <span className="text-slate-500 text-[11px]">Txn: {rc.paymentTransactionId}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-black text-rose-600">{formatVND(rc.refundAmountVnd)}</td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={rc.reason}>
                            {rc.reason}
                          </td>
                          <td className="py-3.5 px-4">
                            {isPending ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                <span>Chờ hoàn tiền</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Đã hoàn tiền</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {rc.proofReference ? (
                              <div className="flex flex-col text-[11px]">
                                <span className="font-mono font-semibold text-slate-800">{rc.proofReference}</span>
                                {rc.proofImageUrl && (
                                  <a
                                    href={rc.proofImageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-brand-600 hover:underline text-[10px]"
                                  >
                                    Xem ảnh biên lai
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Chưa có</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isPending ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setRecordRefundTarget(rc);
                                  setRecordForm({ proofReference: '', proofImageUrl: '' });
                                }}
                                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold rounded-lg transition inline-flex items-center space-x-1 shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Ghi nhận hoàn thực tế</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Đã đối soát xong</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {casesPagination.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Trang <strong>{casesPagination.page}</strong> / <strong>{casesPagination.totalPages}</strong> (Tổng{' '}
                  {casesPagination.total} hồ sơ)
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => fetchRefundCases(casesPagination.page - 1)}
                    disabled={casesPagination.page <= 1 || loadingCases}
                    className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchRefundCases(casesPagination.page + 1)}
                    disabled={casesPagination.page >= casesPagination.totalPages || loadingCases}
                    className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2 CONTENT: Transactions & Exceptions */}
      {activeTab === 'exceptions' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyExceptions}
                onChange={(e) => setOnlyExceptions(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>Chỉ hiển thị giao dịch có ngoại lệ (LATE_PAYMENT, WRONG_AMOUNT, DUPLICATE_PAYMENT)</span>
            </label>

            <button
              type="button"
              onClick={() => fetchTransactions(txnsPagination.page)}
              className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition"
              title="Tải lại"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTxns ? 'animate-spin text-brand-600' : ''}`} />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Mã tham chiếu VNPay</th>
                    <th className="py-3 px-4">Số tiền thực nhận</th>
                    <th className="py-3 px-4">Ngoại lệ phát hiện</th>
                    <th className="py-3 px-4">Trạng thái hợp lệ</th>
                    <th className="py-3 px-4">Thời điểm</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingTxns && transactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                        Đang tải danh sách giao dịch...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400">
                        Không có giao dịch nào phù hợp tiêu chí lọc.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const txid = tx.id || tx._id;
                      const hasException = !!tx.exceptionType;

                      return (
                        <tr key={txid} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {tx.vnpTxnRef || tx.transactionNo || txid}
                          </td>
                          <td className="py-3.5 px-4 font-black text-slate-900">{formatVND(tx.amountVnd)}</td>
                          <td className="py-3.5 px-4">
                            {hasException ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                <ShieldAlert className="w-3 h-3" />
                                <span>{tx.exceptionType}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Không có</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {tx.isAccepted ? (
                              <span className="text-emerald-600 font-semibold inline-flex items-center space-x-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Hợp lệ</span>
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold inline-flex items-center space-x-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Từ chối</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleString('vi-VN') : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {hasException ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setExceptionTargetTxn(tx);
                                  setExceptionRefundReason(
                                    `Hoàn tiền ngoại lệ ${tx.exceptionType}: Giao dịch số tiền ${formatVND(tx.amountVnd)}`
                                  );
                                }}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition inline-flex items-center space-x-1 shadow-sm"
                              >
                                <span>Tạo hoàn ngoại lệ</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Bình thường</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {txnsPagination.totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Trang <strong>{txnsPagination.page}</strong> / <strong>{txnsPagination.totalPages}</strong> (Tổng{' '}
                  {txnsPagination.total} giao dịch)
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => fetchTransactions(txnsPagination.page - 1)}
                    disabled={txnsPagination.page <= 1 || loadingTxns}
                    className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchTransactions(txnsPagination.page + 1)}
                    disabled={txnsPagination.page >= txnsPagination.totalPages || loadingTxns}
                    className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL A: Ghi nhận hoàn tiền thực tế (Section 8.7, Criterion 54) */}
      {recordRefundTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl border border-slate-200 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-brand-600">
                <Receipt className="w-5 h-5" />
                <h2 className="text-base font-bold text-slate-900">Ghi nhận Hoàn tiền Thực tế</h2>
              </div>
              <button
                type="button"
                onClick={() => setRecordRefundTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Tiêu chí Nghiệm thu 54:</span>
              </div>
              <p>
                Chỉ sau khi đã chuyển khoản hoàn tiền thành công bên ngoài hệ thống cho khách hàng, Admin mới ghi nhận mã
                giao dịch tại đây. Hệ thống sẽ chuyển RefundCase sang <code>REFUNDED</code> và cập nhật Booking sang{' '}
                <code>CANCELLED/REFUNDED</code>.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 my-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Mã hồ sơ:</span>
                <span className="font-mono font-bold text-slate-900">{recordRefundTarget.refundCaseCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số tiền cần hoàn:</span>
                <span className="font-bold text-rose-600">{formatVND(recordRefundTarget.refundAmountVnd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lý do hoàn:</span>
                <span className="text-slate-800">{recordRefundTarget.reason}</span>
              </div>
            </div>

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã chứng từ / Mã giao dịch ngân hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: VNPAY-REF-123456 hoặc FT261031987654..."
                  value={recordForm.proofReference}
                  onChange={(e) => setRecordForm({ ...recordForm, proofReference: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Đường dẫn ảnh chứng từ / ủy nhiệm chi (Tùy chọn)
                </label>
                <input
                  type="url"
                  placeholder="https://storage.../receipt.jpg"
                  value={recordForm.proofImageUrl}
                  onChange={(e) => setRecordForm({ ...recordForm, proofImageUrl: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setRecordRefundTarget(null)}
                  disabled={submittingRecord}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingRecord || !recordForm.proofReference.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center space-x-1.5 shadow-sm"
                >
                  {submittingRecord ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{submittingRecord ? 'Đang ghi nhận...' : 'Xác nhận Đã Hoàn Tiền'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL B: Admin hủy & hoàn Booking do cơ sở không phục vụ (Section 8.7, Criteria 13, 53) */}
      {showCancelBookingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl border border-slate-200 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-rose-600">
                <Ban className="w-5 h-5" />
                <h2 className="text-base font-bold text-slate-900">Hỗ trợ Hủy & Hoàn Booking</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelBookingModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-1.5">
              <p className="font-bold">Quy tắc nghiệp vụ Mục 8.7 & Tiêu chí 13, 53:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>Chỉ Admin được hủy Booking đã thanh toán khi cơ sở không thể phục vụ trước giờ kết thúc (endTime).</li>
                <li>Thao tác thực hiện nguyên tử: nhả lịch sân để nhận đặt khác, chuyển trạng thái sang <code>CANCELLED/REFUND_PENDING</code> và tự động tạo hồ sơ RefundCase.</li>
                <li>Không ảnh hưởng các Booking đã xác nhận khác trong cùng yêu cầu thanh toán tổng.</li>
              </ul>
            </div>

            <form onSubmit={handleCancelBookingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ID đơn đặt sân (Booking ID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập MongoDB ObjectId của Booking..."
                  value={cancelForm.bookingId}
                  onChange={(e) => setCancelForm({ ...cancelForm, bookingId: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do hủy bắt buộc <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Ghi rõ lý do cơ sở không phục vụ (mưa bão, hỏng đèn, sự cố kỹ thuật...)"
                  value={cancelForm.reason}
                  onChange={(e) => setCancelForm({ ...cancelForm, reason: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCancelBookingModal(false)}
                  disabled={submittingCancel}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submittingCancel || !cancelForm.bookingId.trim() || !cancelForm.reason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center space-x-1.5 shadow-sm"
                >
                  {submittingCancel ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  <span>{submittingCancel ? 'Đang xử lý...' : 'Xác nhận Hủy & Tạo Hoàn tiền'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL C: Tạo hoàn tiền ngoại lệ (Criterion 49, 55) */}
      {exceptionTargetTxn && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 animate-scaleIn">
            <div className="flex items-center space-x-2 text-purple-600 border-b border-slate-100 pb-3">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900">Tạo Hoàn tiền Ngoại lệ</h2>
            </div>

            <div className="my-3 text-xs text-slate-600 space-y-2">
              <p>
                Giao dịch số <strong>{exceptionTargetTxn.vnpTxnRef || exceptionTargetTxn.id}</strong> bị phát hiện ngoại lệ{' '}
                <span className="font-bold text-purple-700">{exceptionTargetTxn.exceptionType}</span> với số tiền thực
                nhận <strong>{formatVND(exceptionTargetTxn.amountVnd)}</strong>.
              </p>
              <p className="text-[11px] text-slate-500">
                Thao tác này sẽ tạo một hồ sơ RefundCase PENDING gắn trực tiếp với giao dịch ngoại lệ này để chuyển cho
                Admin đối soát chuyển tiền hoàn trả.
              </p>
            </div>

            <form onSubmit={handleExceptionRefundSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do hoàn trả ngoại lệ <span className="text-purple-600">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  value={exceptionRefundReason}
                  onChange={(e) => setExceptionRefundReason(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setExceptionTargetTxn(null)}
                  disabled={submittingExceptionRefund}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingExceptionRefund || !exceptionRefundReason.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center space-x-1.5 shadow-sm"
                >
                  {submittingExceptionRefund ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{submittingExceptionRefund ? 'Đang tạo...' : 'Tạo hồ sơ hoàn tiền'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminRefundsPage;

