import { allUserFixtures, adminUserFixture, ownerUser1Fixture, ownerUser2Fixture, customerUser1Fixture, customerUser2Fixture } from './users.fixture.js';
import { allSportFixtures, footballSportFixture, badmintonSportFixture, tennisSportFixture, pickleballSportFixture } from './sports.fixture.js';
import { allFacilityFixtures, facility1Fixture, facility2Fixture } from './facilities.fixture.js';
import { allFacilitySportFixtures, allCourtFixtures, court1BadmintonFixture, court2BadmintonFixture, court3FootballFixture } from './courts.fixture.js';
import { User, Sport, Facility, FacilitySport, Court } from '../../src/models/index.js';

export * from './users.fixture.js';
export * from './sports.fixture.js';
export * from './facilities.fixture.js';
export * from './courts.fixture.js';

/**
 * Seeds base test fixtures into the specified database
 * @returns {Promise<void>}
 */
export async function seedTestFixtures() {
  await Promise.all([
    User.deleteMany({}),
    Sport.deleteMany({}),
    Facility.deleteMany({}),
    FacilitySport.deleteMany({}),
    Court.deleteMany({}),
  ]);

  await User.insertMany(allUserFixtures);
  await Sport.insertMany(allSportFixtures);
  await Facility.insertMany(allFacilityFixtures);
  await FacilitySport.insertMany(allFacilitySportFixtures);
  await Court.insertMany(allCourtFixtures);
}

/**
 * Clears all test collections
 * @returns {Promise<void>}
 */
export async function clearTestFixtures() {
  await Promise.all([
    User.deleteMany({}),
    Sport.deleteMany({}),
    Facility.deleteMany({}),
    FacilitySport.deleteMany({}),
    Court.deleteMany({}),
  ]);
}
