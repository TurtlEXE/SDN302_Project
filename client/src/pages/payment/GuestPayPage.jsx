import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { paymentService } from '../../services/payment.service.js';

export function GuestPayPage() {
  const { paymentOrderId } = useParams();
  const [searchParams] = useSearchParams();
  const accessCode = searchParams.get('code');

  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchGuestOrder() {
      if (!paymentOrderId || !accessCode) {
        setError('Liên kết thanh toán không hợp lệ hoặc thiếu mã truy cập bí mật.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const res = await paymentService.getGuestPaymentOrder(paymentOrderId, accessCode);
        setOrderData(res.data);
      } catch (err) {
        setError(err.message || 'Không thể tải thông tin đơn thanh toán.');
      } finally {
        setLoading(false);
      }
    }

    fetchGuestOrder();
  }, [paymentOrderId, accessCode]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-gray-500">
        <p className="text-base font-medium">Đang tải thông tin thanh toán đơn đặt sân...</p>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">
          <h2 className="text-lg font-bold mb-2">Không thể truy cập đơn thanh toán</h2>
          <p className="text-sm">{error || 'Đơn thanh toán không tồn tại hoặc đã hết hạn.'}</p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPending = orderData.status === 'PENDING';
  const isPaid = orderData.status === 'PAID';

  const requestNumber =
    orderData.requestNumber ||
    orderData.bookingRequest?.requestNumber ||
    orderData.vnpayTxnRef ||
    orderData.paymentOrderId;

  const contactName =
    orderData.contactName ||
    orderData.bookingRequest?.contactName ||
    'Khách vãng lai';

  const contactPhone =
    orderData.contactPhone ||
    orderData.bookingRequest?.contactPhone ||
    '';

  const totalAmount =
    orderData.totalAmountVnd ??
    orderData.amountVnd ??
    orderData.expectedAmountVnd ??
    0;

  const intervals =
    Array.isArray(orderData.intervals) && orderData.intervals.length > 0
      ? orderData.intervals
      : orderData.startTime && orderData.endTime
      ? [{ startTime: orderData.startTime, endTime: orderData.endTime }]
      : [];

  return (
    <div className="container mx-auto px-4 py-12 max-w-xl">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider mb-2">
            Thanh toán khách vãng lai
          </span>
          <h1 className="text-2xl font-bold text-gray-900">
            Thanh toán đơn #{requestNumber}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Đơn đặt hộ qua chủ sân - Thanh toán an toàn 100% qua VNPay
          </p>
        </div>

        {/* Order Details */}
        <div className="bg-gray-50 rounded-lg p-5 mb-6 border border-gray-200 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Trạng thái:</span>
            <span>
              {isPaid ? (
                <span className="font-bold text-green-600">✓ ĐÃ THANH TOÁN</span>
              ) : isPending ? (
                <span className="font-bold text-amber-600">Chờ thanh toán (Giữ chỗ 10 phút)</span>
              ) : (
                <span className="font-bold text-red-600">{orderData.status}</span>
              )}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Khách hàng:</span>
            <span className="font-medium text-gray-900">
              {contactName} {contactPhone ? `(${contactPhone})` : ''}
            </span>
          </div>

          {(orderData.facilityName || orderData.courtName) && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Sân đặt:</span>
              <span className="font-medium text-gray-900">
                {orderData.courtName} - {orderData.facilityName}
              </span>
            </div>
          )}

          {orderData.bookingDate && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Ngày chơi:</span>
              <span className="font-medium text-gray-900">{orderData.bookingDate}</span>
            </div>
          )}

          {intervals.length > 0 && (
            <div className="text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-600 block mb-1.5 font-medium">Khung giờ đặt:</span>
              <div className="space-y-1.5" data-testid="guest-pay-intervals">
                {intervals.map((inv, idx) => (
                  <div
                    key={`${inv.startTime}-${inv.endTime}-${idx}`}
                    className="flex justify-between items-center bg-white px-3 py-1.5 rounded border border-gray-200 text-xs"
                  >
                    <span className="font-semibold text-blue-700">
                      {inv.startTime} - {inv.endTime}
                    </span>
                    {inv.totalPriceVnd !== undefined && (
                      <span className="text-gray-500 font-medium">
                        {formatCurrency(inv.totalPriceVnd)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
            <span className="text-gray-600 font-semibold">Tổng tiền thanh toán:</span>
            <span className="text-xl font-bold text-red-600" data-testid="guest-pay-total-amount">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          {orderData.expiresAt && isPending && (
            <div className="flex justify-between items-center text-xs text-amber-800 pt-2 border-t border-gray-200">
              <span>Hạn thanh toán:</span>
              <span className="font-bold">
                {new Date(orderData.expiresAt).toLocaleTimeString('vi-VN')}
              </span>
            </div>
          )}
        </div>

        {/* Action Button */}
        {isPending && orderData.paymentUrl ? (
          <div>
            <a
              href={orderData.paymentUrl}
              className="block w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-center rounded-lg shadow-md transition text-base"
            >
              Thanh toán ngay bằng VNPay (QR / Thẻ / Ngân hàng)
            </a>
            <p className="text-center text-xs text-gray-400 mt-3">
              Bạn sẽ được chuyển hướng an toàn sang cổng VNPay để hoàn tất thanh toán.
            </p>
          </div>
        ) : isPaid ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full text-green-600 mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-green-700">
              Đơn đặt sân đã được thanh toán thành công!
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Bạn có thể đến sân trước giờ chơi 10 phút để nhận sân.
            </p>
          </div>
        ) : (
          <div className="text-center text-sm text-red-600">
            Đơn này không còn ở trạng thái có thể thanh toán.
          </div>
        )}
      </div>
    </div>
  );
}

export default GuestPayPage;

