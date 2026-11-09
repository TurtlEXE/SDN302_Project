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

  let ownerCaugiay = await User.findOne({ email: 'owner.caugiay@sportbooking.local' });
  if (!ownerCaugiay) {
    ownerCaugiay = await User.create({
      email: 'owner.caugiay@sportbooking.local',
      passwordHash,
      fullName: 'Chủ Sân Cầu Giấy (Phạm Hoàng Nam)',
      phoneNumber: '0902000003',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
  }

  let ownerHaibatrung = await User.findOne({ email: 'owner.haibatrung@sportbooking.local' });
  if (!ownerHaibatrung) {
    ownerHaibatrung = await User.create({
      email: 'owner.haibatrung@sportbooking.local',
      passwordHash,
      fullName: 'Chủ Sân Hai Bà Trưng (Vũ Minh Đức)',
      phoneNumber: '0902000004',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
  }

  let ownerSaigon = await User.findOne({ email: 'owner.saigon@sportbooking.local' });
  if (!ownerSaigon) {
    ownerSaigon = await User.create({
      email: 'owner.saigon@sportbooking.local',
      passwordHash,
      fullName: 'Chủ Sân Tân Bình Sài Gòn (Lê Quốc Bảo)',
      phoneNumber: '0902000005',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
  }

  let ownerThuduc = await User.findOne({ email: 'owner.thuduc@sportbooking.local' });
  if (!ownerThuduc) {
    ownerThuduc = await User.create({
      email: 'owner.thuduc@sportbooking.local',
      passwordHash,
      fullName: 'Chủ Sân Thủ Đức (Đặng Thùy Dung)',
      phoneNumber: '0902000006',
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
  const createWeeklySchedule = (openTime, closeTime) => ({
    monday: { isOpen: true, openTime, closeTime },
    tuesday: { isOpen: true, openTime, closeTime },
    wednesday: { isOpen: true, openTime, closeTime },
    thursday: { isOpen: true, openTime, closeTime },
    friday: { isOpen: true, openTime, closeTime },
    saturday: { isOpen: true, openTime, closeTime },
    sunday: { isOpen: true, openTime, closeTime },
  });

  // Hanoi Facility - Ba Đình
  let facilityHanoi = await Facility.findOne({ name: 'Sân Cầu Lông Ba Đình' });
  if (!facilityHanoi) {
    facilityHanoi = await Facility.create({
      name: 'Sân Cầu Lông Ba Đình',
      description: 'Cơ sở cầu lông hiện đại với thảm thi đấu tiêu chuẩn BWF, hệ thống quạt công nghiệp và đèn chống lóa.',
      address: 'Số 15 Phố Liễu Giai, Phường Cống Vị, Ba Đình, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0902000001',
      openTime: '06:00',
      closeTime: '22:00',
      weeklySchedule: createWeeklySchedule('06:00', '22:00'),
      ownerId: ownerHanoi._id,
      status: 'PUBLISHED',
      images: [
        {
          id: 'hn-img-1',
          url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1200&auto=format&fit=crop',
          isCover: true,
          order: 0,
        },
        {
          id: 'hn-img-2',
          url: 'https://images.unsplash.com/photo-1613918108466-292b78a8ef95?q=80&w=1200&auto=format&fit=crop',
          isCover: false,
          order: 1,
        },
        {
          id: 'hn-img-3',
          url: 'https://images.unsplash.com/photo-1521537634581-0dced2fedc42?q=80&w=1200&auto=format&fit=crop',
          isCover: false,
          order: 2,
        },
      ],
    });
  } else if (!facilityHanoi.images || facilityHanoi.images.length < 3) {
    facilityHanoi.images = [
      {
        id: 'hn-img-1',
        url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1200&auto=format&fit=crop',
        isCover: true,
        order: 0,
      },
      {
        id: 'hn-img-2',
        url: 'https://images.unsplash.com/photo-1613918108466-292b78a8ef95?q=80&w=1200&auto=format&fit=crop',
        isCover: false,
        order: 1,
      },
      {
        id: 'hn-img-3',
        url: 'https://images.unsplash.com/photo-1521537634581-0dced2fedc42?q=80&w=1200&auto=format&fit=crop',
        isCover: false,
        order: 2,
      },
    ];
    await facilityHanoi.save();
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

  // Hanoi Facility 2 - Cầu Giấy
  let facilityCaugiay = await Facility.findOne({ name: 'CLB Cầu Lông Cầu Giấy Premium' });
  if (!facilityCaugiay) {
    facilityCaugiay = await Facility.create({
      name: 'CLB Cầu Lông Cầu Giấy Premium',
      description: 'Tổ hợp sân cầu lông cao cấp 100% thảm Yonex chuẩn BWF, trần cao 11m thoáng mát, đèn LED rọi chống chói, khu nghỉ ngơi và phòng tắm nóng lạnh tiện nghi.',
      address: 'Số 35 Dịch Vọng Hậu, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0902000003',
      openTime: '05:30',
      closeTime: '23:00',
      weeklySchedule: createWeeklySchedule('05:30', '23:00'),
      ownerId: ownerCaugiay._id,
      status: 'PUBLISHED',
      images: [
        {
          id: 'cg-img-1',
          url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=1200&auto=format&fit=crop',
          isCover: true,
          order: 0,
        },
        {
          id: 'cg-img-2',
          url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop',
          isCover: false,
          order: 1,
        },
        {
          id: 'cg-img-3',
          url: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=80&w=1200&auto=format&fit=crop',
          isCover: false,
          order: 2,
        },
      ],
    });
  }

  let fSportCaugiay = await FacilitySport.findOne({ facilityId: facilityCaugiay._id, sportId: sportsMap.BADMINTON._id });
  if (!fSportCaugiay) {
    fSportCaugiay = await FacilitySport.create({
      facilityId: facilityCaugiay._id,
      sportId: sportsMap.BADMINTON._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });
  }

  // Hanoi Facility 3 - Hai Bà Trưng
  let facilityHaibatrung = await Facility.findOne({ name: 'Nhà Thi Đấu Cầu Lông Bách Khoa Arena' });
  if (!facilityHaibatrung) {
    facilityHaibatrung = await Facility.create({
      name: 'Nhà Thi Đấu Cầu Lông Bách Khoa Arena',
      description: 'Tổ hợp nhà thi đấu cầu lông tại trung tâm Hai Bà Trưng. Thảm Enlio Pro tiêu chuẩn, sàn gỗ đệm chống chấn thương, quầy căng cước vợt và phục vụ đồ uống thể thao.',
      address: 'Số 42 Tạ Quang Bửu, Phường Bách Khoa, Quận Hai Bà Trưng, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0902000004',
      openTime: '06:00',
      closeTime: '22:30',
      weeklySchedule: createWeeklySchedule('06:00', '22:30'),
      ownerId: ownerHaibatrung._id,
      status: 'PUBLISHED',
      images: [
        {
          id: 'bk-img-1',
          url: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?q=80&w=1200&auto=format&fit=crop',
          isCover: true,
          order: 0,
        },
        {
          id: 'bk-img-2',
          url: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?q=80&w=1200&auto=format&fit=crop',
          isCover: false,
          order: 1,
        },
        {
          id: 'bk-img-3',
          url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1200&auto=format&fit=crop',
          isCover: false,
          order: 2,
        },
      ],
    });
  }

  let fSportHaibatrung = await FacilitySport.findOne({ facilityId: facilityHaibatrung._id, sportId: sportsMap.BADMINTON._id });
  if (!fSportHaibatrung) {
    fSportHaibatrung = await FacilitySport.create({
      facilityId: facilityHaibatrung._id,
      sportId: sportsMap.BADMINTON._id,
      slotStepMinutes: 60,
      configVersion: 1,
    });
  }

  // HCM Facility 1 - Tân Bình
  let facilitySaigon = await Facility.findOne({ name: 'Trung Tâm Cầu Lông Sài Gòn Star - Tân Bình' });
  if (!facilitySaigon) {
    facilitySaigon = await Facility.create({
      name: 'Trung Tâm Cầu Lông Sài Gòn Star - Tân Bình',
      description: 'Hệ thống sân cầu lông hiện đại bậc nhất khu vực Tân Bình - sân bay. Trang bị sàn gỗ kỹ thuật đệm mút cao cấp giảm chấn, trần cao 12m cực kỳ thông thoáng.',
      address: 'Số 18A Hoàng Hoa Thám, Phường 12, Quận Tân Bình, TP. Hồ Chí Minh',
      province: 'Hồ Chí Minh',
      phoneNumber: '0902000005',
      openTime: '05:00',
      closeTime: '23:00',
      weeklySchedule: createWeeklySchedule('05:00', '23:00'),
      ownerId: ownerSaigon._id,
      status: 'PUBLISHED',
      images: [
        {
          id: 'sg-img-1',
          url: 'https://images.unsplash.com/photo-1563299796-17596ed6b017?q=80&w=1200&auto=format&fit=crop',
          isCover: true,
          order: 0,
        },
        {
          id: 'sg-img-2',
          url: 'https://images.unsplash.com/photo-1521537634581-0dced2fedc42?q=80&w=1200&auto=format&fit=crop',
          isCover: false,
          order: 1,
        },
        {
          id: 'sg-img-3',
          url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=1200&auto=format&fit=crop',
          isCover: false,
          order: 2,
        },
      ],
    });
  }

  let fSportSaigon = await FacilitySport.findOne({ facilityId: facilitySaigon._id, sportId: sportsMap.BADMINTON._id });
  if (!fSportSaigon) {
    fSportSaigon = await FacilitySport.create({
      facilityId: facilitySaigon._id,
      sportId: sportsMap.BADMINTON._id,
      slotStepMinutes: 60,
      configVersion: 1,
    });
  }

  // HCM Facility 2 - Thủ Đức
  let facilityThuduc = await Facility.findOne({ name: 'CLB Cầu Lông Thủ Đức Badminton Center' });
  if (!facilityThuduc) {
    facilityThuduc = await Facility.create({
      name: 'CLB Cầu Lông Thủ Đức Badminton Center',
      description: 'Cụm sân cầu lông quy chuẩn gần Làng Đại Học và trung tâm Thủ Đức. Không gian trẻ trung năng động, bãi giữ xe rộng rãi, quầy phụ kiện và nước giải khát đa dạng.',
      address: 'Số 26 Đường Số 9, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh',
      province: 'Hồ Chí Minh',
      phoneNumber: '0902000006',
      openTime: '06:00',
      closeTime: '22:00',
      weeklySchedule: createWeeklySchedule('06:00', '22:00'),
      ownerId: ownerThuduc._id,
      status: 'PUBLISHED',
      images: [
        {
          id: 'td-img-1',
          url: 'https://images.unsplash.com/photo-1613918108466-292b78a8ef95?q=80&w=1200&auto=format&fit=crop',
          isCover: true,
          order: 0,
        },
        {
          id: 'td-img-2',
          url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=1200&auto=format&fit=crop',
          isCover: false,
          order: 1,
        },
        {
          id: 'td-img-3',
          url: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?q=80&w=1200&auto=format&fit=crop',
          isCover: false,
          order: 2,
        },
      ],
    });
  }

  let fSportThuduc = await FacilitySport.findOne({ facilityId: facilityThuduc._id, sportId: sportsMap.BADMINTON._id });
  if (!fSportThuduc) {
    fSportThuduc = await FacilitySport.create({
      facilityId: facilityThuduc._id,
      sportId: sportsMap.BADMINTON._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });
  }

  // Danang Facility - Sơn Trà
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
      weeklySchedule: createWeeklySchedule('06:00', '23:00'),
      ownerId: ownerDanang._id,
      status: 'PUBLISHED',
      images: [
        {
          id: 'dn-img-1',
          url: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=1200&auto=format&fit=crop',
          isCover: true,
          order: 0,
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

  // 4. Courts Helper
  const upsertCourtDoc = async ({
    facilityId,
    facilitySportId,
    sportId,
    name,
    description,
    pricePerHourVnd,
    pricingRules,
    isActive = true,
  }) => {
    let court = await Court.findOne({ facilityId, name });
    if (!court) {
      court = await Court.create({
        facilityId,
        facilitySportId,
        sportId,
        name,
        description: description || '',
        pricePerHourVnd,
        priceVersion: 1,
        pricingRules: pricingRules || [],
        isActive,
        bookingCoordinationVersion: 1,
      });
    } else {
      let changed = false;
      if (description && court.description !== description) {
        court.description = description;
        changed = true;
      }
      if (pricingRules && pricingRules.length > 0 && (!court.pricingRules || court.pricingRules.length === 0)) {
        court.pricingRules = pricingRules;
        changed = true;
      }
      if (changed) {
        await court.save();
      }
    }
    return court;
  };

  // 4.1. Facility Ba Đình Courts (Hà Nội - Owner Hanoi)
  const fSportHanoiId = fSportHanoi._id;
  let courtHN1 = await upsertCourtDoc({
    facilityId: facilityHanoi._id,
    facilitySportId: fSportHanoiId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân 1',
    description: 'Sân cầu lông thảm PVC tiêu chuẩn BWF số 1, đèn LED 500 Lux chống chói',
    pricePerHourVnd: 100000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 100000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '18:00', pricePerHourVnd: 100000 },
      { dayType: 'WEEKDAY', startTime: '18:00', endTime: '22:00', pricePerHourVnd: 150000 },
      { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 180000 },
    ],
  });

  let courtHN2 = await upsertCourtDoc({
    facilityId: facilityHanoi._id,
    facilitySportId: fSportHanoiId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân 2',
    description: 'Sân cầu lông thảm PVC tiêu chuẩn BWF số 2, khoảng cách biên rộng thoáng an toàn',
    pricePerHourVnd: 120000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 110000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '22:00', pricePerHourVnd: 160000 },
      { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 190000 },
    ],
  });

  let courtHN3 = await upsertCourtDoc({
    facilityId: facilityHanoi._id,
    facilitySportId: fSportHanoiId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân 3 (Sân VIP)',
    description: 'Sân thảm Yonex dày 5mm tiêu chuẩn thi đấu quốc tế, khán đài mini và điều hòa',
    pricePerHourVnd: 140000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 130000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '22:00', pricePerHourVnd: 170000 },
      { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 200000 },
    ],
  });

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

  // 4.2. Facility Cầu Giấy Courts (Hà Nội - Owner Cầu Giấy)
  const fSportCaugiayId = fSportCaugiay._id;
  let courtCG1 = await upsertCourtDoc({
    facilityId: facilityCaugiay._id,
    facilitySportId: fSportCaugiayId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân CG-01 (Thảm Yonex A)',
    description: 'Sân thảm Yonex vân cát xanh lá, bám giày cực tốt, đèn chống chói 500 Lux',
    pricePerHourVnd: 110000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '05:30', endTime: '17:00', pricePerHourVnd: 100000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '23:00', pricePerHourVnd: 160000 },
      { dayType: 'WEEKEND', startTime: '05:30', endTime: '23:00', pricePerHourVnd: 180000 },
    ],
  });

  let courtCG2 = await upsertCourtDoc({
    facilityId: facilityCaugiay._id,
    facilitySportId: fSportCaugiayId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân CG-02 (Thảm Yonex B)',
    description: 'Sân thảm Yonex chất lượng cao, trang bị quạt gió hướng âm và ghế nghỉ vận động viên',
    pricePerHourVnd: 110000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '05:30', endTime: '17:00', pricePerHourVnd: 100000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '23:00', pricePerHourVnd: 160000 },
      { dayType: 'WEEKEND', startTime: '05:30', endTime: '23:00', pricePerHourVnd: 180000 },
    ],
  });

  let courtCG3 = await upsertCourtDoc({
    facilityId: facilityCaugiay._id,
    facilitySportId: fSportCaugiayId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân CG-VIP (Sân Thi Đấu)',
    description: 'Sân trung tâm không gian rộng rãi, camera góc rộng ghi hình trận đấu và ghế bành VIP',
    pricePerHourVnd: 160000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '05:30', endTime: '17:00', pricePerHourVnd: 140000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '23:00', pricePerHourVnd: 200000 },
      { dayType: 'WEEKEND', startTime: '05:30', endTime: '23:00', pricePerHourVnd: 230000 },
    ],
  });

  // 4.3. Facility Bách Khoa Courts (Hai Bà Trưng - Owner Hai Bà Trưng)
  const fSportHaibatrungId = fSportHaibatrung._id;
  let courtBK1 = await upsertCourtDoc({
    facilityId: facilityHaibatrung._id,
    facilitySportId: fSportHaibatrungId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân BK-01 (Thảm Enlio Pro A)',
    description: 'Sân thảm Enlio Pro vân đá xanh biển, đàn hồi cao, đường kẻ biên sắc nét',
    pricePerHourVnd: 120000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 100000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '22:30', pricePerHourVnd: 150000 },
      { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:30', pricePerHourVnd: 180000 },
    ],
  });

  let courtBK2 = await upsertCourtDoc({
    facilityId: facilityHaibatrung._id,
    facilitySportId: fSportHaibatrungId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân BK-02 (Thảm Enlio Pro B)',
    description: 'Sân tiêu chuẩn thi đấu phong trào, ánh sáng bố trí dọc biên không gây lóa mắt khi đập cầu',
    pricePerHourVnd: 120000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 100000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '22:30', pricePerHourVnd: 150000 },
      { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:30', pricePerHourVnd: 180000 },
    ],
  });

  let courtBK3 = await upsertCourtDoc({
    facilityId: facilityHaibatrung._id,
    facilitySportId: fSportHaibatrungId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân BK-03 (Sân Khán Đài)',
    description: 'Sân trung tâm có khán đài 60 chỗ ngồi, bảng điểm lật tay và hệ thống âm thanh thông báo',
    pricePerHourVnd: 140000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 120000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '22:30', pricePerHourVnd: 180000 },
      { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:30', pricePerHourVnd: 210000 },
    ],
  });

  // 4.4. Facility Sài Gòn Star Courts (Tân Bình - Owner Sài Gòn)
  const fSportSaigonId = fSportSaigon._id;
  let courtSG1 = await upsertCourtDoc({
    facilityId: facilitySaigon._id,
    facilitySportId: fSportSaigonId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân SG-A1 (Sàn Gỗ Giảm Chấn A)',
    description: 'Sàn gỗ Maple tự nhiên đàn hồi cao cấp, bảo vệ đầu gối và cổ chân tối đa',
    pricePerHourVnd: 130000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '05:00', endTime: '16:00', pricePerHourVnd: 110000 },
      { dayType: 'WEEKDAY', startTime: '16:00', endTime: '23:00', pricePerHourVnd: 170000 },
      { dayType: 'WEEKEND', startTime: '05:00', endTime: '23:00', pricePerHourVnd: 200000 },
    ],
  });

  let courtSG2 = await upsertCourtDoc({
    facilityId: facilitySaigon._id,
    facilitySportId: fSportSaigonId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân SG-A2 (Sàn Gỗ Giảm Chấn B)',
    description: 'Sàn gỗ công nghệ mới, khoảng cách an toàn giữa các sân rộng 2m tránh va chạm',
    pricePerHourVnd: 130000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '05:00', endTime: '16:00', pricePerHourVnd: 110000 },
      { dayType: 'WEEKDAY', startTime: '16:00', endTime: '23:00', pricePerHourVnd: 170000 },
      { dayType: 'WEEKEND', startTime: '05:00', endTime: '23:00', pricePerHourVnd: 200000 },
    ],
  });

  let courtSG3 = await upsertCourtDoc({
    facilityId: facilitySaigon._id,
    facilitySportId: fSportSaigonId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân SG-B1 (Thảm Taraflex Quốc Tế 1)',
    description: 'Thảm Taraflex chuyên dụng cho các giải đấu quốc tế, độ bám sân và nảy cầu tiêu chuẩn',
    pricePerHourVnd: 140000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '05:00', endTime: '16:00', pricePerHourVnd: 120000 },
      { dayType: 'WEEKDAY', startTime: '16:00', endTime: '23:00', pricePerHourVnd: 180000 },
      { dayType: 'WEEKEND', startTime: '05:00', endTime: '23:00', pricePerHourVnd: 210000 },
    ],
  });

  let courtSG4 = await upsertCourtDoc({
    facilityId: facilitySaigon._id,
    facilitySportId: fSportSaigonId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân SG-B2 (Thảm Taraflex Quốc Tế 2)',
    description: 'Thảm thi đấu Taraflex chính hãng, hệ thống đèn chiếu sáng cạnh sân chống mỏi mắt',
    pricePerHourVnd: 140000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '05:00', endTime: '16:00', pricePerHourVnd: 120000 },
      { dayType: 'WEEKDAY', startTime: '16:00', endTime: '23:00', pricePerHourVnd: 180000 },
      { dayType: 'WEEKEND', startTime: '05:00', endTime: '23:00', pricePerHourVnd: 210000 },
    ],
  });

  // 4.5. Facility Thủ Đức Courts (Thủ Đức - Owner Thủ Đức)
  const fSportThuducId = fSportThuduc._id;
  let courtTD1 = await upsertCourtDoc({
    facilityId: facilityThuduc._id,
    facilitySportId: fSportThuducId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân TĐ-01 (Thảm Alite Xanh A)',
    description: 'Thảm đúc Alite độ bám tuyệt vời, lưới chuẩn thi đấu, quạt làm mát công suất lớn',
    pricePerHourVnd: 100000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 90000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '22:00', pricePerHourVnd: 140000 },
      { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 170000 },
    ],
  });

  let courtTD2 = await upsertCourtDoc({
    facilityId: facilityThuduc._id,
    facilitySportId: fSportThuducId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân TĐ-02 (Thảm Alite Xanh B)',
    description: 'Sân thảm Alite đạt chuẩn tập luyện học sinh, sinh viên và câu lạc bộ cuối tuần',
    pricePerHourVnd: 100000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 90000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '22:00', pricePerHourVnd: 140000 },
      { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 170000 },
    ],
  });

  let courtTD3 = await upsertCourtDoc({
    facilityId: facilityThuduc._id,
    facilitySportId: fSportThuducId,
    sportId: sportsMap.BADMINTON._id,
    name: 'Sân TĐ-VIP (Máy Bắn Cầu & Ghế VIP)',
    description: 'Sân VIP có kèm máy bắn cầu tự động hỗ trợ rèn luyện kỹ thuật cá nhân hoặc đánh đôi',
    pricePerHourVnd: 160000,
    pricingRules: [
      { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 140000 },
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '22:00', pricePerHourVnd: 200000 },
      { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 230000 },
    ],
  });

  // 4.6. Danang Football Court
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
  const facilitiesToUnlock = [
    facilityHanoi,
    facilityDanang,
    facilityCaugiay,
    facilityHaibatrung,
    facilitySaigon,
    facilityThuduc,
  ];
  for (const fac of facilitiesToUnlock) {
    const logCount = await ActionLog.countDocuments({ action: 'UNLOCK_FACILITY', targetId: fac._id });
    if (logCount === 0) {
      await ActionLog.create({
        actorId: admin._id,
        actorRole: 'ADMIN',
        targetType: 'FACILITY',
        targetId: fac._id,
        action: 'UNLOCK_FACILITY',
        reason: 'Khởi tạo và mở hoạt động cơ sở demo',
        previousState: null,
        newState: { status: 'PUBLISHED' },
      });
    }
  }

  // Count total badminton courts
  const badmintonCourtCount = await Court.countDocuments({ sportId: sportsMap.BADMINTON._id });

  logger.info(`[SeedDemo] Demo data seeded successfully. Badminton courts: ${badmintonCourtCount}`);

  return {
    success: true,
    users: {
      admin: admin.email,
      owners: [
        ownerHanoi.email,
        ownerDanang.email,
        ownerCaugiay.email,
        ownerHaibatrung.email,
        ownerSaigon.email,
        ownerThuduc.email,
      ],
      customers: [customerAn.email, customerBinh.email],
    },
    facilities: [
      facilityHanoi.name,
      facilityDanang.name,
      facilityCaugiay.name,
      facilityHaibatrung.name,
      facilitySaigon.name,
      facilityThuduc.name,
    ],
    badmintonCourtsCount: badmintonCourtCount,
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
