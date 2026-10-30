import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { authorize } from '../middlewares/auth.js';
import { uploadSingleFacilityImage } from '../middlewares/upload.js';
import { facilityController } from '../controllers/facility.controller.js';
import { courtController } from '../controllers/court.controller.js';
import { courtBlockController } from '../controllers/court-block.controller.js';
import { bookingRequestController } from '../controllers/booking-request.controller.js';
import { bookingController } from '../controllers/booking.controller.js';
import { dashboardController } from '../controllers/dashboard.controller.js';

const router = Router();

// Protect all owner routes with authenticate and authorize('OWNER')
router.use(authenticate, authorize('OWNER'));

// ==========================================
// OWNER DASHBOARD (OWN-10)
// ==========================================
router.get('/dashboard', dashboardController.getOwnerDashboard.bind(dashboardController));

// ==========================================
// OWNER FACILITIES
// ==========================================
router.get('/facilities', facilityController.listOwnerFacilities.bind(facilityController));
router.post('/facilities', facilityController.createOwnerFacility.bind(facilityController));
router.get('/facilities/:id', facilityController.getOwnerFacilityById.bind(facilityController));
router.patch('/facilities/:id', facilityController.updateOwnerFacility.bind(facilityController));

// Image Management
router.post(
  '/facilities/:id/images',
  uploadSingleFacilityImage,
  facilityController.uploadFacilityImage.bind(facilityController)
);
router.delete(
  '/facilities/:id/images/:imageId',
  facilityController.deleteFacilityImage.bind(facilityController)
);
router.patch(
  '/facilities/:id/images/:imageId/set-cover',
  facilityController.setCoverImage.bind(facilityController)
);

// Facility Sports & Slot Steps
router.get(
  '/facilities/:id/sports',
  facilityController.listFacilitySports.bind(facilityController)
);
router.post(
  '/facilities/:id/sports',
  facilityController.addFacilitySport.bind(facilityController)
);
router.patch(
  '/facilities/:id/sports/:facilitySportId',
  facilityController.updateFacilitySportStep.bind(facilityController)
);

// ==========================================
// OWNER COURTS
// ==========================================
router.get('/courts', courtController.listOwnerCourts.bind(courtController));
router.post('/courts', courtController.createOwnerCourt.bind(courtController));
router.patch('/courts/:id', courtController.updateOwnerCourt.bind(courtController));

// ==========================================
// OWNER ON-BEHALF BOOKINGS (OWN-08)
// ==========================================
router.post(
  '/bookings/on-behalf',
  bookingRequestController.createOnBehalfBooking.bind(bookingRequestController)
);

// ==========================================
// OWNER COURT BLOCKS (OWN-06)
// ==========================================
router.get('/court-blocks', courtBlockController.listCourtBlocks.bind(courtBlockController));
router.post('/court-blocks', courtBlockController.createCourtBlock.bind(courtBlockController));
router.delete('/court-blocks/:id', courtBlockController.deleteCourtBlock.bind(courtBlockController));

// ==========================================
// OWNER BOOKING OPERATIONS (OWN-07, OWN-09)
// ==========================================
router.get('/bookings', bookingController.listOwnerBookings.bind(bookingController));
router.get('/bookings/:id', bookingController.getOwnerBookingById.bind(bookingController));
router.post('/bookings/:id/complete', bookingController.completeBooking.bind(bookingController));
router.post('/bookings/:id/no-show', bookingController.markNoShowBooking.bind(bookingController));
router.post('/booking-requests/:id/cancel', bookingRequestController.cancelBookingRequest.bind(bookingRequestController));

export default router;

