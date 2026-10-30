import mongoose from 'mongoose';
import { Facility } from '../models/facility.model.js';
import { escapeRegex } from '../utils/pagination.js';

export class FacilityRepository {
  /**
   * Finds a Facility by its ID
   * @param {string} id
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findById(id, session = null) {
    return Facility.findById(id).session(session);
  }

  /**
   * Lists facilities owned by a specific owner
   * @param {string} ownerId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByOwner(ownerId, session = null) {
    return Facility.find({ ownerId }).sort({ createdAt: -1 }).session(session);
  }

  /**
   * Alias for findByOwner
   * @param {string} ownerId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByOwnerId(ownerId, session = null) {
    return this.findByOwner(ownerId, session);
  }

  /**
   * Creates a new Facility
   * @param {Object} data
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async create(data, session = null) {
    const [created] = await Facility.create([data], { session });
    return created;
  }

  /**
   * Updates facility by ID
   * @param {string} id
   * @param {Object} updateData
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async updateById(id, updateData, session = null) {
    return Facility.findByIdAndUpdate(id, { $set: updateData }, { new: true, session });
  }

  /**
   * Appends an image to facility images array
   * @param {string} facilityId
   * @param {Object} image
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async addImage(facilityId, image, session = null) {
    return Facility.findByIdAndUpdate(
      facilityId,
      { $push: { images: image } },
      { new: true, session }
    );
  }

  /**
   * Removes an image by imageId
   * @param {string} facilityId
   * @param {string} imageId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async removeImage(facilityId, imageId, session = null) {
    return Facility.findByIdAndUpdate(
      facilityId,
      { $pull: { images: { id: imageId } } },
      { new: true, session }
    );
  }

  /**
   * Sets cover image: isCover = true for matching imageId, false for others
   * @param {string} facilityId
   * @param {string} imageId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async setCoverImage(facilityId, imageId, session = null) {
    const facility = await Facility.findById(facilityId).session(session);
    if (!facility) return null;

    facility.images.forEach((img) => {
      img.isCover = img.id === imageId;
    });

    await facility.save({ session });
    return facility;
  }

  /**
   * Locks facility by admin
   * @param {string} id
   * @param {string} reason
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async lockFacility(id, reason, session = null) {
    return Facility.findByIdAndUpdate(
      id,
      {
        $set: {
          isLockedByAdmin: true,
          lockReason: reason,
        },
      },
      { new: true, session }
    );
  }

  /**
   * Unlocks facility by admin.
   * STRICT: Does NOT change status from PAUSED or DRAFT to PUBLISHED (Criteria 21).
   * @param {string} id
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async unlockFacility(id, session = null) {
    return Facility.findByIdAndUpdate(
      id,
      {
        $set: {
          isLockedByAdmin: false,
          lockReason: null,
        },
      },
      { new: true, session }
    );
  }

  /**
   * Builds an aggregation pipeline for public search & filtering
   * Criteria:
   * - status = 'PUBLISHED'
   * - isLockedByAdmin = false
   * - Owner must be active (isLocked = false, activatedAt != null)
   * - Must have >= 1 active court (matching sportId and price range if provided)
   */
  buildPublicAggregationPipeline({
    keyword,
    province,
    sportId,
    minPrice,
    maxPrice,
    sort,
  }) {
    const matchFacility = {
      status: 'PUBLISHED',
      isLockedByAdmin: false,
    };

    if (keyword && keyword.trim()) {
      const safeKeyword = escapeRegex(keyword.trim());
      matchFacility.$or = [
        { name: { $regex: safeKeyword, $options: 'i' } },
        { address: { $regex: safeKeyword, $options: 'i' } },
      ];
    }

    if (province && province.trim()) {
      const safeProvince = escapeRegex(province.trim());
      matchFacility.province = { $regex: `^${safeProvince}$`, $options: 'i' };
    }

    const courtMatch = {
      isActive: true,
    };

    if (sportId && mongoose.Types.ObjectId.isValid(sportId)) {
      courtMatch.sportId = new mongoose.Types.ObjectId(sportId);
    }

    if (minPrice !== undefined && minPrice !== null) {
      courtMatch.pricePerHourVnd = { ...courtMatch.pricePerHourVnd, $gte: Number(minPrice) };
    }
    if (maxPrice !== undefined && maxPrice !== null) {
      courtMatch.pricePerHourVnd = { ...courtMatch.pricePerHourVnd, $lte: Number(maxPrice) };
    }

    const pipeline = [
      { $match: matchFacility },
      // Lookup Owner to verify active & not locked
      {
        $lookup: {
          from: 'users',
          localField: 'ownerId',
          foreignField: '_id',
          as: 'owner',
        },
      },
      { $unwind: '$owner' },
      {
        $match: {
          'owner.isLocked': false,
          'owner.activatedAt': { $ne: null },
        },
      },
      // Lookup active courts matching filters
      {
        $lookup: {
          from: 'courts',
          let: { facId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$facilityId', '$$facId'] },
                ...courtMatch,
              },
            },
          ],
          as: 'matchingCourts',
        },
      },
      // Facility must have at least one matching active court
      {
        $match: {
          'matchingCourts.0': { $exists: true },
        },
      },
      // Compute minPricePerHour
      {
        $addFields: {
          minPricePerHour: { $min: '$matchingCourts.pricePerHourVnd' },
        },
      },
    ];

    // Sorting
    let sortStage = { createdAt: -1 };
    if (sort === 'name_asc') sortStage = { name: 1 };
    else if (sort === 'name_desc') sortStage = { name: -1 };
    else if (sort === 'price_asc') sortStage = { minPricePerHour: 1, name: 1 };
    else if (sort === 'price_desc') sortStage = { minPricePerHour: -1, name: 1 };

    pipeline.push({ $sort: sortStage });

    return pipeline;
  }

  /**
   * Finds public facilities with pagination
   */
  async findPublicFacilities(params) {
    const { skip = 0, limit = 10 } = params;
    const pipeline = this.buildPublicAggregationPipeline(params);

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    return Facility.aggregate(pipeline);
  }

  /**
   * Counts public facilities matching filters
   */
  async countPublicFacilities(params) {
    const pipeline = this.buildPublicAggregationPipeline(params);
    pipeline.push({ $count: 'total' });

    const result = await Facility.aggregate(pipeline);
    return result[0]?.total || 0;
  }

  /**
   * Admin lists all facilities with search and filters
   */
  buildAdminQuery({ search, status, isLockedByAdmin, province, ownerId }) {
    const query = {};

    if (search && search.trim()) {
      const safeSearch = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { address: { $regex: safeSearch, $options: 'i' } },
        { phoneNumber: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (isLockedByAdmin !== undefined && isLockedByAdmin !== null) {
      query.isLockedByAdmin = isLockedByAdmin === 'true' || isLockedByAdmin === true;
    }

    if (province && province.trim()) {
      query.province = { $regex: `^${escapeRegex(province.trim())}$`, $options: 'i' };
    }

    if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
      query.ownerId = new mongoose.Types.ObjectId(ownerId);
    }

    return query;
  }

  async findAllAdmin(params) {
    const { skip = 0, limit = 10, ...filterParams } = params;
    const query = this.buildAdminQuery(filterParams);

    return Facility.find(query)
      .populate('ownerId', 'fullName email phoneNumber isLocked')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async countAllAdmin(params) {
    const query = this.buildAdminQuery(params);
    return Facility.countDocuments(query);
  }

  /**
   * Formats to FacilityDTO
   */
  toDTO(facility, minPricePerHour = null) {
    if (!facility) return null;

    const coverImage =
      facility.images?.find((img) => img.isCover)?.url ||
      facility.images?.[0]?.url ||
      null;

    const resolvedOwnerId =
      typeof facility.ownerId === 'object' && facility.ownerId !== null && facility.ownerId._id
        ? facility.ownerId._id.toString()
        : facility.ownerId
        ? facility.ownerId.toString()
        : '';

    return {
      id: facility._id.toString(),
      ownerId: resolvedOwnerId,
      name: facility.name,
      description: facility.description || '',
      address: facility.address,
      province: facility.province,
      phoneNumber: facility.phoneNumber,
      openTime: facility.openTime,
      closeTime: facility.closeTime,
      operatingHoursVersion: facility.operatingHoursVersion || 1,
      minPricePerHour:
        minPricePerHour !== null
          ? minPricePerHour
          : facility.minPricePerHour !== undefined
          ? facility.minPricePerHour
          : null,
      coverImageUrl: coverImage,
      status: facility.status,
      isLockedByAdmin: facility.isLockedByAdmin || false,
      lockReason: facility.lockReason || null,
      createdAt: facility.createdAt,
      updatedAt: facility.updatedAt,
    };
  }

  /**
   * Formats to FacilityDetailDTO
   */
  toDetailDTO(facility, facilitySports = [], courts = [], minPricePerHour = null) {
    const baseDTO = this.toDTO(facility, minPricePerHour);
    if (!baseDTO) return null;

    return {
      ...baseDTO,
      images: (facility.images || []).map((img) => ({
        id: img.id,
        url: img.url,
        isCover: img.isCover || false,
        order: img.order || 0,
      })),
      facilitySports,
      courts,
    };
  }
}

export const facilityRepository = new FacilityRepository();
export default facilityRepository;

