import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authService } from '../../services/auth.service.js';
import { CheckCircle2, AlertCircle, MailCheck, Loader2, ArrowRight } from 'lucide-react';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleVerify = async () => {
    if (!token) {
      setError('Mã xác thực không hợp lệ hoặc đã bị thiếu trên đường dẫn.');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      await authService.verifyEmail(token);
      setIsSuccess(true);
    } catch (err) {
      setError(err.message || 'Mã xác thực không hợp lệ, đã hết hạn hoặc đã được sử dụng trước đó.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-6">
        {isSuccess ? (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-50 text-brand-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Xác thực thành công!</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tài khoản của bạn đã được kích hoạt thành công. Giờ đây bạn có thể đăng nhập và sử
              dụng toàn bộ tính năng của hệ sinh thái SportBooking.
            </p>
            <div className="pt-2">
              <Link
                to="/login"
                className="inline-flex items-center justify-center space-x-2 w-full py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-sm transition"
              >
                <span>Đăng nhập ngay</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-50 text-brand-600">
              <MailCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Xác thực Email tài khoản</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Nhấn nút bên dưới để hoàn tất xác thực địa chỉ email cho tài khoản của bạn.
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-700 text-xs text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {!token ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-left">
                Không tìm thấy mã token xác thực trên URL. Vui lòng kiểm tra lại liên kết trong email của bạn.
              </div>
            ) : (
              <button
                type="button"
                onClick={handleVerify}
                disabled={isVerifying}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-sm transition active:scale-[0.99] disabled:opacity-60"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xác nhận...</span>
                  </>
                ) : (
                  <span>Xác nhận kích hoạt tài khoản</span>
                )}
              </button>
            )}

            <div className="pt-2 border-t border-slate-100">
              <Link to="/login" className="text-xs font-medium text-slate-500 hover:text-brand-600">
                Quay lại trang Đăng nhập
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

