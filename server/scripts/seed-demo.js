import { fileURLToPath } from 'url';
import path from 'path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import { User } from '../src/models/user.model.js';
import { Sport } from '../src/models/sport.model.js';
import { Facility } from '../src/models/facility.model.js';
import { FacilitySport } from '../src/models/facility-sport.model.js';
import { Court } from '../src/models/court.model.js';
import { BookingRequest } from '../src/models/booking-request.model.js';
import { Booking } from '../src/models/booking.model.js';
import { PaymentOrder } from '../src/models/payment-order.model.js';
import { PaymentTransaction } from '../src/models/payment-transaction.model.js';
import { RefundCase } from '../src/models/refund-case.model.js';
import { EmailOutbox } from '../src/models/email-outbox.model.js';
import { ActionLog } from '../src/models/action-log.model.js';
import { CourtBlock } from '../src/models/court-block.model.js';
import { getCurrentDateVN, parseTimeToMinutes } from '../src/utils/date-time.js';

/**
 * Seeds comprehensive demo data for SportBooking Platform.
 * Sets up realistic operational and financial scenarios to test and verify
 * dashboard metrics, status separation, exception handling, and email outbox monitoring.
 *
 * @param {string} [uri]
 * @returns {Promise<Object>} Seed summary
 */
export async function seedDemo(uri = env.MONGODB_URI) {
  await connectDB(uri);

  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const now = new Date();
  const todayStr = getCurrentDateVN();

  logger.info('[SeedDemo] Starting demo data seeding...');

  // 1. Users
  // Admin
  let admin = await User.findOne({ email: 'admin@sportbooking.local' });
  if (!admin) {
    admin = await User.create({
      email: 'admin@sportbooking.local',
      passwordHash,
      fullName: 'Platform Administrator',
      phoneNumber: '0901000001',
      role: 'ADMIN',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
  }

  // Owners
  let ownerHanoi = await User.findOne({ email: 'owner.hanoi@sportbooking.local' });
  if (!ownerHanoi) {
    ownerHanoi = await User.create({
      email: 'owner.hanoi@sportbooking.local',
      passwordHash,
      fullName: 'Chủ Sân Hà Nội',
      phoneNumber: '0902000001',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
  }

  let ownerDanang = await User.findOne({ email: 'owner.danang@sportbooking.local' });
  if (!ownerDanang) {
    ownerDanang = await User.create({
      email: 'owner.danang@sportbooking.local',
      passwordHash,
      fullName: 'Chủ Sân Đà Nẵng',
      phoneNumber: '0902000002',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
  }

  // Customers
  let customerAn = await User.findOne({ email: 'customer.an@sportbooking.local' });
  if (!customerAn) {
    customerAn = await User.create({
      email: 'customer.an@sportbooking.local',
      passwordHash,
      fullName: 'Nguyễn Văn An',
      phoneNumber: '0903000001',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
  }

  let customerBinh = await User.findOne({ email: 'customer.binh@sportbooking.local' });
  if (!customerBinh) {
    customerBinh = await User.create({
      email: 'customer.binh@sportbooking.local',
      passwordHash,
      fullName: 'Trần Thị Bình',
      phoneNumber: '0903000002',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
  }

  // 2. Sports
  const sportNames = [
    { code: 'BADMINTON', name: 'Cầu lông', normalizedName: 'CAU LONG', description: 'Môn cầu lông trong nhà' },
    { code: 'PICKLEBALL', name: 'Pickleball', normalizedName: 'PICKLEBALL', description: 'Môn bóng vợt Pickleball' },
    { code: 'FOOTBALL', name: 'Bóng đá', normalizedName: 'BONG DA', description: 'Sân bóng mini cỏ nhân tạo' },
    { code: 'TENNIS', name: 'Tennis', normalizedName: 'TENNIS', description: 'Sân quần vợt tiêu chuẩn' },
  ];

  const sportsMap = {};
  for (const item of sportNames) {
    let sp = await Sport.findOne({ normalizedName: item.normalizedName });
    if (!sp) {
      sp = await Sport.create({
        name: item.name,
        normalizedName: item.normalizedName,
        description: item.description,
        isActive: true,
      });
    }
    sportsMap[item.code] = sp;
  }

  // 3. Facilities
  // Hanoi Facility
  let facilityHanoi = await Facility.findOne({ name: 'Sân Cầu Lông Ba Đình' });
  if (!facilityHanoi) {
    facilityHanoi = await Facility.create({
      name: 'Sân Cầu Lông Ba Đình',
      description: 'Cơ sở cầu lông hiện đại với thảm thi đấu tiêu chuẩn BWF',
      address: 'Số 15 Phố Liễu Giai, Phường Cống Vị, Ba Đình, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0902000001',
      openTime: '06:00',
      closeTime: '22:00',
      ownerId: ownerHanoi._id,
      status: 'PUBLISHED',
      images: [
        {
          id: 'hn-img-1',
          url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea',
          isCover: true,
        },
      ],
    });
  }

  let fSportHanoi = await FacilitySport.findOne({ facilityId: facilityHanoi._id, sportId: sportsMap.BADMINTON._id });
  if (!fSportHanoi) {
    fSportHanoi = await FacilitySport.create({
      facilityId: facilityHanoi._id,
      sportId: sportsMap.BADMINTON._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });
  }

  let fSportHanoiPickleball = await FacilitySport.findOne({ facilityId: facilityHanoi._id, sportId: sportsMap.PICKLEBALL._id });
  if (!fSportHanoiPickleball) {
    fSportHanoiPickleball = await FacilitySport.create({
      facilityId: facilityHanoi._id,
      sportId: sportsMap.PICKLEBALL._id,
      slotStepMinutes: 60,
      configVersion: 1,
    });
  }

  // Danang Facility
  let facilityDanang = await Facility.findOne({ name: 'Sân Bóng Đá Sơn Trà' });
  if (!facilityDanang) {
    facilityDanang = await Facility.create({
      name: 'Sân Bóng Đá Sơn Trà',
      description: 'Sân bóng đá cỏ nhân tạo cao cấp ven biển',
      address: 'Đường Võ Nguyên Giáp, Phước Mỹ, Sơn Trà, Đà Nẵng',
      province: 'Đà Nẵng',
      phoneNumber: '0902000002',
      openTime: '06:00',
      closeTime: '23:00',
      ownerId: ownerDanang._id,
      status: 'PUBLISHED',
      images: [
        {
          id: 'dn-img-1',
          url: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6',
          isCover: true,
        },
      ],
    });
  }

  let fSportDanang = await FacilitySport.findOne({ facilityId: facilityDanang._id, sportId: sportsMap.FOOTBALL._id });
  if (!fSportDanang) {
    fSportDanang = await FacilitySport.create({
      facilityId: facilityDanang._id,
      sportId: sportsMap.FOOTBALL._id,
      slotStepMinutes: 90,
      configVersion: 1,
    });
  }

  // 4. Courts
  const fSportHanoiId = fSportHanoi._id;
  let courtHN1 = await Court.findOne({ facilityId: facilityHanoi._id, name: 'Sân 1' });
  if (!courtHN1) {
    courtHN1 = await Court.create({
      facilityId: facilityHanoi._id,
      facilitySportId: fSportHanoiId,
      sportId: sportsMap.BADMINTON._id,
      name: 'Sân 1',
      pricePerHourVnd: 100000,
      pricingRules: [
        { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 100000 },
        { dayType: 'WEEKDAY', startTime: '17:00', endTime: '18:00', pricePerHourVnd: 100000 },
        { dayType: 'WEEKDAY', startTime: '18:00', endTime: '22:00', pricePerHourVnd: 150000 },
        { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 180000 },
      ],
      isActive: true,
    });
  } else if (!courtHN1.pricingRules || courtHN1.pricingRules.length === 0) {
    courtHN1.pricingRules = [
      { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 100000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '18:00', pricePerHourVnd: 100000 },
      { dayType: 'WEEKDAY', startTime: '18:00', endTime: '22:00', pricePerHourVnd: 150000 },
      { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 180000 },
    ];
    await courtHN1.save();
  }

  let courtHN2 = await Court.findOne({ facilityId: facilityHanoi._id, name: 'Sân 2' });
  if (!courtHN2) {
    courtHN2 = await Court.create({
      facilityId: facilityHanoi._id,
      facilitySportId: fSportHanoiId,
      sportId: sportsMap.BADMINTON._id,
      name: 'Sân 2',
      pricePerHourVnd: 120000,
      pricingRules: [
        { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 110000 },
        { dayType: 'WEEKDAY', startTime: '17:00', endTime: '22:00', pricePerHourVnd: 160000 },
        { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 190000 },
      ],
      isActive: true,
    });
  } else if (!courtHN2.pricingRules || courtHN2.pricingRules.length === 0) {
    courtHN2.pricingRules = [
      { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 110000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '22:00', pricePerHourVnd: 160000 },
      { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 190000 },
    ];
    await courtHN2.save();
  }

  // Hanoi Pickleball Courts (slotStepMinutes: 60)
  const fSportHanoiPKId = fSportHanoiPickleball._id;
  let courtPK1 = await Court.findOne({ facilityId: facilityHanoi._id, name: 'Sân Pickleball 1' });
  if (!courtPK1) {
    courtPK1 = await Court.create({
      facilityId: facilityHanoi._id,
      facilitySportId: fSportHanoiPKId,
      sportId: sportsMap.PICKLEBALL._id,
      name: 'Sân Pickleball 1',
      pricePerHourVnd: 140000,
      pricingRules: [
        { dayType: 'WEEKDAY', startTime: '06:00', endTime: '16:00', pricePerHourVnd: 120000 },
        { dayType: 'WEEKDAY', startTime: '16:00', endTime: '22:00', pricePerHourVnd: 180000 },
        { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 220000 },
      ],
      isActive: true,
    });
  }

  let courtPK2 = await Court.findOne({ facilityId: facilityHanoi._id, name: 'Sân Pickleball 2' });
  if (!courtPK2) {
    courtPK2 = await Court.create({
      facilityId: facilityHanoi._id,
      facilitySportId: fSportHanoiPKId,
      sportId: sportsMap.PICKLEBALL._id,
      name: 'Sân Pickleball 2',
      pricePerHourVnd: 150000,
      pricingRules: [
        { dayType: 'WEEKDAY', startTime: '06:00', endTime: '12:00', pricePerHourVnd: 120000 },
        { dayType: 'WEEKDAY', startTime: '14:00', endTime: '22:00', pricePerHourVnd: 180000 },
        { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 220000 },
      ],
      isActive: true,
    });
  }

  const fSportDanangId = fSportDanang._id;
  let courtDN1 = await Court.findOne({ facilityId: facilityDanang._id, name: 'Sân 7A' });
  if (!courtDN1) {
    courtDN1 = await Court.create({
      facilityId: facilityDanang._id,
      facilitySportId: fSportDanangId,
      sportId: sportsMap.FOOTBALL._id,
      name: 'Sân 7A',
      pricePerHourVnd: 300000,
      isActive: true,
    });
  }

  // Helper function to create valid booking request
  const createBookingRequestDoc = async (data) => {
    let br = await BookingRequest.findOne({ requestNumber: data.requestNumber });
    if (!br) {
      br = await BookingRequest.create({
        requestNumber: data.requestNumber,
        customerId: data.customerId || null,
        createdBy: data.createdBy,
        source: data.source || 'CUSTOMER_ONLINE',
        courtId: data.courtId,
        facilityId: data.facilityId,
        bookingDate: data.bookingDate,
        totalAmountVnd: data.totalAmountVnd,
        holdExpiresAt: data.holdExpiresAt || new Date(Date.now() + 10 * 60 * 1000),
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        idempotencyKey: `IDEMP-${data.requestNumber}`,
        payloadFingerprint: `FP-${data.requestNumber}`,
      });
    }
    return br;
  };

  // Helper function to create valid payment order
  const createPaymentOrderDoc = async (data) => {
    let po = await PaymentOrder.findOne({ vnpayTxnRef: data.vnpayTxnRef });
    if (!po) {
      po = await PaymentOrder.create({
        bookingRequestId: data.bookingRequestId,
        vnpayTxnRef: data.vnpayTxnRef,
        expectedAmountVnd: data.expectedAmountVnd,
        status: data.status || 'PENDING',
        expiresAt: data.expiresAt || new Date(Date.now() + 10 * 60 * 1000),
      });
    }
    return po;
  };

  // Helper function to create valid payment transaction
  const createPaymentTxnDoc = async (data) => {
    let pt = await PaymentTransaction.findOne({ vnpayTxnRef: data.vnpayTxnRef });
    if (!pt) {
      pt = await PaymentTransaction.create({
        paymentOrderId: data.paymentOrderId || null,
        vnpayTransactionNo: data.vnpayTransactionNo || `VNPAY-${Date.now()}`,
        vnpayTxnRef: data.vnpayTxnRef,
        amountVnd: data.amountVnd,
        bankCode: data.bankCode || 'NCB',
        responseCode: data.responseCode || '00',
        transactionStatus: data.transactionStatus || '00',
        payDate: data.payDate || now,
        isAccepted: data.isAccepted !== undefined ? data.isAccepted : true,
        exceptionType: data.exceptionType || null,
        rawCallbackData: data.rawCallbackData || {
          vnp_Amount: String(data.amountVnd * 100),
          vnp_ResponseCode: data.responseCode || '00',
          vnp_TransactionStatus: data.transactionStatus || '00',
        },
      });
    }
    return pt;
  };

  // Helper function to create valid booking
  const createBookingDoc = async (data) => {
    let bk = await Booking.findOne({ bookingCode: data.bookingCode });
    if (!bk) {
      const startMinutes = parseTimeToMinutes(data.startTime);
      const endMinutes = parseTimeToMinutes(data.endTime);
      bk = await Booking.create({
        bookingRequestId: data.bookingRequestId,
        bookingCode: data.bookingCode,
        customerId: data.customerId || null,
        facilityId: data.facilityId,
        courtId: data.courtId,
        bookingDate: data.bookingDate,
        startTime: data.startTime,
        endTime: data.endTime,
        startMinutes,
        endMinutes,
        durationMinutes: endMinutes - startMinutes,
        pricePerHourVnd: data.pricePerHourVnd,
        totalPriceVnd: data.totalPriceVnd,
        allocatedAmountVnd: data.allocatedAmountVnd || data.totalPriceVnd,
        status: data.status || 'PENDING_PAYMENT',
        paymentStatus: data.paymentStatus || 'UNPAID',
        holdExpiresAt: data.holdExpiresAt || new Date(Date.now() + 10 * 60 * 1000),
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        completion: data.completion || null,
        cancellation: data.cancellation || null,
        snapshot: {
          facilityName: data.snapshot?.facilityName || '',
          facilityAddress: data.snapshot?.facilityAddress || '',
          courtName: data.snapshot?.courtName || '',
          sportName: data.snapshot?.sportName || '',
          slotStepMinutes: data.snapshot?.slotStepMinutes || 30,
        },
      });
    }
    return bk;
  };

  // Helper function to create valid court block
  const createCourtBlockDoc = async (data) => {
    let cb = await CourtBlock.findOne({
      courtId: data.courtId,
      bookingDate: data.bookingDate,
      startTime: data.startTime,
    });
    if (!cb) {
      const startMinutes = parseTimeToMinutes(data.startTime);
      const endMinutes = parseTimeToMinutes(data.endTime);
      cb = await CourtBlock.create({
        courtId: data.courtId,
        bookingDate: data.bookingDate,
        startTime: data.startTime,
        endTime: data.endTime,
        startMinutes,
        endMinutes,
        reason: data.reason,
        createdBy: data.createdBy,
        isActive: true,
      });
    }
    return cb;
  };

  // 5. Booking Scenario (Testing all states and financial calculations)
  // 5.1. Past Booking: COMPLETED / PAID (Yesterday, Customer An at Sân 1 Ba Đình)
  const br1 = await createBookingRequestDoc({
    requestNumber: 'REQ-DEMO-001',
    customerId: customerAn._id,
    createdBy: customerAn._id,
    courtId: courtHN1._id,
    facilityId: facilityHanoi._id,
    bookingDate: '2026-10-28',
    totalAmountVnd: 200000,
    contactName: customerAn.fullName,
    contactPhone: customerAn.phoneNumber,
  });

  const po1 = await createPaymentOrderDoc({
    bookingRequestId: br1._id,
    vnpayTxnRef: 'TXN-DEMO-001',
    expectedAmountVnd: 200000,
    status: 'PAID',
  });

  const pt1 = await createPaymentTxnDoc({
    paymentOrderId: po1._id,
    vnpayTransactionNo: 'VNPAY-DEMO-TXN-001',
    vnpayTxnRef: po1.vnpayTxnRef,
    amountVnd: 200000,
    payDate: new Date('2026-10-28T07:50:00Z'),
  });

  await createBookingDoc({
    bookingRequestId: br1._id,
    bookingCode: 'DEMO-COMPLETED-01',
    customerId: customerAn._id,
    facilityId: facilityHanoi._id,
    courtId: courtHN1._id,
    bookingDate: '2026-10-28',
    startTime: '08:00',
    endTime: '10:00',
    pricePerHourVnd: 100000,
    totalPriceVnd: 200000,
    allocatedAmountVnd: 200000,
    status: 'COMPLETED',
    paymentStatus: 'PAID',
    contactName: customerAn.fullName,
    contactPhone: customerAn.phoneNumber,
    completion: {
      completedAt: new Date('2026-10-28T10:05:00Z'),
      completedBy: ownerHanoi._id,
      note: 'Đã phục vụ hoàn tất đúng giờ',
    },
    snapshot: {
      facilityName: facilityHanoi.name,
      facilityAddress: facilityHanoi.address,
      courtName: courtHN1.name,
      sportName: 'Cầu lông',
      slotStepMinutes: 30,
    },
  });

  // 5.2. Past Booking: NO_SHOW / PAID (Yesterday, Customer Binh at Sân 2 Ba Đình)
  const br2 = await createBookingRequestDoc({
    requestNumber: 'REQ-DEMO-002',
    customerId: customerBinh._id,
    createdBy: customerBinh._id,
    courtId: courtHN2._id,
    facilityId: facilityHanoi._id,
    bookingDate: '2026-10-28',
    totalAmountVnd: 180000,
    contactName: customerBinh.fullName,
    contactPhone: customerBinh.phoneNumber,
  });

  const po2 = await createPaymentOrderDoc({
    bookingRequestId: br2._id,
    vnpayTxnRef: 'TXN-DEMO-002',
    expectedAmountVnd: 180000,
    status: 'PAID',
  });

  const pt2 = await createPaymentTxnDoc({
    paymentOrderId: po2._id,
    vnpayTransactionNo: 'VNPAY-DEMO-TXN-002',
    vnpayTxnRef: po2.vnpayTxnRef,
    amountVnd: 180000,
    payDate: new Date('2026-10-28T13:45:00Z'),
  });

  await createBookingDoc({
    bookingRequestId: br2._id,
    bookingCode: 'DEMO-NOSHOW-01',
    customerId: customerBinh._id,
    facilityId: facilityHanoi._id,
    courtId: courtHN2._id,
    bookingDate: '2026-10-28',
    startTime: '14:00',
    endTime: '15:30',
    pricePerHourVnd: 120000,
    totalPriceVnd: 180000,
    allocatedAmountVnd: 180000,
    status: 'NO_SHOW',
    paymentStatus: 'PAID',
    contactName: customerBinh.fullName,
    contactPhone: customerBinh.phoneNumber,
    completion: {
      completedAt: new Date('2026-10-28T15:40:00Z'),
      completedBy: ownerHanoi._id,
      note: 'Khách không đến sân',
    },
    snapshot: {
      facilityName: facilityHanoi.name,
      facilityAddress: facilityHanoi.address,
      courtName: courtHN2.name,
      sportName: 'Cầu lông',
      slotStepMinutes: 30,
    },
  });

  // 5.3. Past Booking: CANCELLED / REFUNDED with executed RefundCase
  const br3 = await createBookingRequestDoc({
    requestNumber: 'REQ-DEMO-003',
    customerId: customerAn._id,
    createdBy: customerAn._id,
    courtId: courtHN1._id,
    facilityId: facilityHanoi._id,
    bookingDate: '2026-10-29',
    totalAmountVnd: 100000,
    contactName: customerAn.fullName,
    contactPhone: customerAn.phoneNumber,
  });

  const po3 = await createPaymentOrderDoc({
    bookingRequestId: br3._id,
    vnpayTxnRef: 'TXN-DEMO-003',
    expectedAmountVnd: 100000,
    status: 'PAID',
  });

  const pt3 = await createPaymentTxnDoc({
    paymentOrderId: po3._id,
    vnpayTransactionNo: 'VNPAY-DEMO-TXN-003',
    vnpayTxnRef: po3.vnpayTxnRef,
    amountVnd: 100000,
    payDate: new Date('2026-10-29T15:00:00Z'),
  });

  const pastRefundedBooking = await createBookingDoc({
    bookingRequestId: br3._id,
    bookingCode: 'DEMO-REFUNDED-01',
    customerId: customerAn._id,
    facilityId: facilityHanoi._id,
    courtId: courtHN1._id,
    bookingDate: '2026-10-29',
    startTime: '16:00',
    endTime: '17:00',
    pricePerHourVnd: 100000,
    totalPriceVnd: 100000,
    allocatedAmountVnd: 100000,
    status: 'CANCELLED',
    paymentStatus: 'REFUNDED',
    contactName: customerAn.fullName,
    contactPhone: customerAn.phoneNumber,
    cancellation: {
      cancelledAt: new Date('2026-10-29T15:30:00Z'),
      cancelledBy: admin._id,
      reason: 'Sân bị sự cố ánh sáng đột xuất',
    },
    snapshot: {
      facilityName: facilityHanoi.name,
      facilityAddress: facilityHanoi.address,
      courtName: courtHN1.name,
      sportName: 'Cầu lông',
      slotStepMinutes: 30,
    },
  });

  let rf1 = await RefundCase.findOne({ refundCaseCode: 'RF20261029-DEMO01' });
  if (!rf1) {
    await RefundCase.create({
      refundCaseCode: 'RF20261029-DEMO01',
      bookingId: pastRefundedBooking._id,
      paymentTransactionId: pt3._id,
      refundAmountVnd: 100000,
      reason: 'Sân bị sự cố ánh sáng đột xuất',
      status: 'REFUNDED',
      proofReference: 'UNC-VNPAY-REFUND-999888',
      processedBy: admin._id,
      processedAt: new Date('2026-10-29T17:00:00Z'),
    });
  }

  // 5.4. Today Booking: CONFIRMED / PAID (Upcoming today at Hanoi)
  const br4 = await createBookingRequestDoc({
    requestNumber: 'REQ-DEMO-004',
    customerId: customerAn._id,
    createdBy: customerAn._id,
    courtId: courtHN1._id,
    facilityId: facilityHanoi._id,
    bookingDate: todayStr,
    totalAmountVnd: 200000,
    contactName: customerAn.fullName,
    contactPhone: customerAn.phoneNumber,
  });

  const po4 = await createPaymentOrderDoc({
    bookingRequestId: br4._id,
    vnpayTxnRef: 'TXN-DEMO-004',
    expectedAmountVnd: 200000,
    status: 'PAID',
  });

  const pt4 = await createPaymentTxnDoc({
    paymentOrderId: po4._id,
    vnpayTransactionNo: 'VNPAY-DEMO-TXN-004',
    vnpayTxnRef: po4.vnpayTxnRef,
    amountVnd: 200000,
    payDate: now,
  });

  await createBookingDoc({
    bookingRequestId: br4._id,
    bookingCode: 'DEMO-TODAY-CONFIRMED-01',
    customerId: customerAn._id,
    facilityId: facilityHanoi._id,
    courtId: courtHN1._id,
    bookingDate: todayStr,
    startTime: '18:00',
    endTime: '20:00',
    pricePerHourVnd: 100000,
    totalPriceVnd: 200000,
    allocatedAmountVnd: 200000,
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    contactName: customerAn.fullName,
    contactPhone: customerAn.phoneNumber,
    snapshot: {
      facilityName: facilityHanoi.name,
      facilityAddress: facilityHanoi.address,
      courtName: courtHN1.name,
      sportName: 'Cầu lông',
      slotStepMinutes: 30,
    },
  });

  // 5.5. Today Booking: CANCELLED / REFUND_PENDING (with PENDING RefundCase)
  const br5 = await createBookingRequestDoc({
    requestNumber: 'REQ-DEMO-005',
    customerId: customerBinh._id,
    createdBy: customerBinh._id,
    courtId: courtHN2._id,
    facilityId: facilityHanoi._id,
    bookingDate: todayStr,
    totalAmountVnd: 120000,
    contactName: customerBinh.fullName,
    contactPhone: customerBinh.phoneNumber,
  });

  const po5 = await createPaymentOrderDoc({
    bookingRequestId: br5._id,
    vnpayTxnRef: 'TXN-DEMO-005',
    expectedAmountVnd: 120000,
    status: 'PAID',
  });

  const pt5 = await createPaymentTxnDoc({
    paymentOrderId: po5._id,
    vnpayTransactionNo: 'VNPAY-DEMO-TXN-005',
    vnpayTxnRef: po5.vnpayTxnRef,
    amountVnd: 120000,
    payDate: now,
  });

  const todayPendingRefundBooking = await createBookingDoc({
    bookingRequestId: br5._id,
    bookingCode: 'DEMO-TODAY-PENDING-REFUND-01',
    customerId: customerBinh._id,
    facilityId: facilityHanoi._id,
    courtId: courtHN2._id,
    bookingDate: todayStr,
    startTime: '20:00',
    endTime: '21:00',
    pricePerHourVnd: 120000,
    totalPriceVnd: 120000,
    allocatedAmountVnd: 120000,
    status: 'CANCELLED',
    paymentStatus: 'REFUND_PENDING',
    contactName: customerBinh.fullName,
    contactPhone: customerBinh.phoneNumber,
    cancellation: {
      cancelledAt: now,
      cancelledBy: admin._id,
      reason: 'Chủ sân báo bận việc khẩn cấp',
    },
    snapshot: {
      facilityName: facilityHanoi.name,
      facilityAddress: facilityHanoi.address,
      courtName: courtHN2.name,
      sportName: 'Cầu lông',
      slotStepMinutes: 30,
    },
  });

  let rf2 = await RefundCase.findOne({ refundCaseCode: 'RF20261030-PENDING01' });
  if (!rf2) {
    await RefundCase.create({
      refundCaseCode: 'RF20261030-PENDING01',
      bookingId: todayPendingRefundBooking._id,
      paymentTransactionId: pt5._id,
      refundAmountVnd: 120000,
      reason: 'Chủ sân báo bận việc khẩn cấp',
      status: 'PENDING',
    });
  }

  // 5.6. Today Active Hold Booking (Testing HOLD status on Hanoi Court 1)
  const brHold = await createBookingRequestDoc({
    requestNumber: 'REQ-DEMO-HOLD-01',
    customerId: customerBinh._id,
    createdBy: customerBinh._id,
    courtId: courtHN1._id,
    facilityId: facilityHanoi._id,
    bookingDate: todayStr,
    totalAmountVnd: 100000,
    holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // active hold for next 15 mins
    contactName: customerBinh.fullName,
    contactPhone: customerBinh.phoneNumber,
  });

  await createBookingDoc({
    bookingRequestId: brHold._id,
    bookingCode: 'DEMO-HOLD-01',
    customerId: customerBinh._id,
    facilityId: facilityHanoi._id,
    courtId: courtHN1._id,
    bookingDate: todayStr,
    startTime: '10:00',
    endTime: '11:00',
    pricePerHourVnd: 100000,
    totalPriceVnd: 100000,
    allocatedAmountVnd: 100000,
    status: 'PENDING_PAYMENT',
    paymentStatus: 'UNPAID',
    holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    contactName: customerBinh.fullName,
    contactPhone: customerBinh.phoneNumber,
    snapshot: {
      facilityName: facilityHanoi.name,
      facilityAddress: facilityHanoi.address,
      courtName: courtHN1.name,
      sportName: 'Cầu lông',
      slotStepMinutes: 30,
    },
  });

  // 5.7. Today Court Block (Testing BLOCKED status on Hanoi Court 2)
  await createCourtBlockDoc({
    courtId: courtHN2._id,
    bookingDate: todayStr,
    startTime: '14:00',
    endTime: '16:00',
    reason: 'Bảo trì thay thế thảm thi đấu và kiểm tra đèn chiếu sáng',
    createdBy: ownerHanoi._id,
  });

  // 5.8. Today Confirmed Booking on Pickleball (Testing Pickleball multi-sport schedule)
  const brPK1 = await createBookingRequestDoc({
    requestNumber: 'REQ-DEMO-PK1-01',
    customerId: customerAn._id,
    createdBy: customerAn._id,
    courtId: courtPK1._id,
    facilityId: facilityHanoi._id,
    bookingDate: todayStr,
    totalAmountVnd: 240000,
    contactName: customerAn.fullName,
    contactPhone: customerAn.phoneNumber,
  });

  const poPK1 = await createPaymentOrderDoc({
    bookingRequestId: brPK1._id,
    vnpayTxnRef: 'TXN-DEMO-PK1-01',
    expectedAmountVnd: 240000,
    status: 'PAID',
  });

  await createPaymentTxnDoc({
    paymentOrderId: poPK1._id,
    vnpayTransactionNo: 'VNPAY-DEMO-TXN-PK1',
    vnpayTxnRef: poPK1.vnpayTxnRef,
    amountVnd: 240000,
    payDate: now,
  });

  await createBookingDoc({
    bookingRequestId: brPK1._id,
    bookingCode: 'DEMO-TODAY-CONFIRMED-PK1',
    customerId: customerAn._id,
    facilityId: facilityHanoi._id,
    courtId: courtPK1._id,
    bookingDate: todayStr,
    startTime: '08:00',
    endTime: '10:00',
    pricePerHourVnd: 120000,
    totalPriceVnd: 240000,
    allocatedAmountVnd: 240000,
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    contactName: customerAn.fullName,
    contactPhone: customerAn.phoneNumber,
    snapshot: {
      facilityName: facilityHanoi.name,
      facilityAddress: facilityHanoi.address,
      courtName: courtPK1.name,
      sportName: 'Pickleball',
      slotStepMinutes: 60,
    },
  });

  // 6. Exception PaymentTransaction (REQUIRES_ACTION for Admin inspection)
  const exceptionTxn = await createPaymentTxnDoc({
    vnpayTransactionNo: 'VNPAY-EX-999001',
    vnpayTxnRef: 'TXN-DEMO-EXCEPTION-01',
    amountVnd: 150000,
    payDate: now,
    isAccepted: false,
    exceptionType: 'LATE_PAYMENT',
  });

  // 7. Email Outbox entries (SENT, FAILED, PENDING for Admin monitoring)
  let outboxFailed = await EmailOutbox.findOne({ eventKey: 'DEMO_EMAIL_FAILED_01' });
  if (!outboxFailed) {
    outboxFailed = await EmailOutbox.create({
      eventKey: 'DEMO_EMAIL_FAILED_01',
      eventType: 'BOOKING_CONFIRMED',
      recipientEmail: 'customer.retry@sportbooking.local',
      recipientName: 'Khách Thử Nghiệm',
      subject: '[SportBooking] Xác nhận đặt sân thành công - REQ-DEMO-ERR',
      templateName: 'booking-confirmed',
      templateData: {
        name: 'Khách Thử Nghiệm',
        requestNumber: 'REQ-DEMO-ERR',
        totalAmountVnd: 100000,
      },
      status: 'FAILED',
      retryCount: 3,
      lastError: 'SMTP Connection timed out after 3 attempts',
    });
  }

  let outboxSent = await EmailOutbox.findOne({ eventKey: 'DEMO_EMAIL_SENT_01' });
  if (!outboxSent) {
    outboxSent = await EmailOutbox.create({
      eventKey: 'DEMO_EMAIL_SENT_01',
      eventType: 'BOOKING_CONFIRMED',
      recipientEmail: 'customer.an@sportbooking.local',
      recipientName: 'Nguyễn Văn An',
      subject: '[SportBooking] Xác nhận đặt sân thành công - REQ-DEMO-001',
      templateName: 'booking-confirmed',
      templateData: {
        name: 'Nguyễn Văn An',
        requestNumber: 'REQ-DEMO-001',
        totalAmountVnd: 200000,
      },
      status: 'SENT',
      retryCount: 0,
      sentAt: now,
    });
  }

  // 8. Action Logs
  const logCount = await ActionLog.countDocuments({ action: 'UNLOCK_FACILITY', targetId: facilityHanoi._id });
  if (logCount === 0) {
    await ActionLog.create({
      actorId: admin._id,
      actorRole: 'ADMIN',
      targetType: 'FACILITY',
      targetId: facilityHanoi._id,
      action: 'UNLOCK_FACILITY',
      reason: 'Khởi tạo và mở hoạt động cơ sở demo',
      previousState: null,
      newState: { status: 'PUBLISHED' },
    });
  }

  logger.info('[SeedDemo] Demo data seeded successfully.');

  return {
    success: true,
    users: {
      admin: admin.email,
      owners: [ownerHanoi.email, ownerDanang.email],
      customers: [customerAn.email, customerBinh.email],
    },
    facilities: [facilityHanoi.name, facilityDanang.name],
    sampleBookings: [
      'DEMO-COMPLETED-01',
      'DEMO-NOSHOW-01',
      'DEMO-REFUNDED-01',
      'DEMO-TODAY-CONFIRMED-01',
      'DEMO-TODAY-PENDING-REFUND-01',
    ],
  };
}

// Execute if run directly from CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seedDemo()
    .then((summary) => {
      logger.info(`Demo seeding complete: ${JSON.stringify(summary, null, 2)}`);
      return disconnectDB();
    })
    .catch((err) => {
      logger.error(`Seed demo failed: ${err.message}`, { stack: err.stack });
      disconnectDB().finally(() => process.exit(1));
    });
}
