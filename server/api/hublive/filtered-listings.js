const { getSdk, serialize, getIntegrationSdk } = require('../../api-util/sdk');

const transformBounds = (bounds) => {
  return `${bounds.ne.lat},${bounds.ne.lng},${bounds.sw.lat},${bounds.sw.lng}`;
};

const isDateRangeInRage = (dateStart, dateEnd, start, end) => {
  const dateStartTime = dateStart.getTime();
  const dateEndTime = dateEnd.getTime();
  const startTime = start.getTime();
  const endTime = end.getTime();

  return dateStartTime >= startTime && dateEndTime <= endTime;
};

const filterBookingsInRange = (booking, range) => {
  const { start, end } = booking.attributes;
  return isDateRangeInRage(start, end, range.start, range.end);
};

const getWeekBounds = (startDate, endDate, excludeEndDate = false) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0); // set to midnight
  // date filter includes extra day
  if (excludeEndDate) {
    end.setDate(end.getDate() - 1);
  }
  end.setHours(23, 59, 59, 999); // set to right before midnight

  const weekBreakpoints = [start];

  const closestSunday = new Date();
  closestSunday.setDate(start.getDate() + 7 - start.getDay());
  closestSunday.setHours(23, 59, 59, 999);

  weekBreakpoints.push(closestSunday);

  while (weekBreakpoints[weekBreakpoints.length - 1] < end) {
    const date = new Date(weekBreakpoints[weekBreakpoints.length - 1].getTime());
    date.setDate(date.getDate() + 7);

    if (date < end) {
      weekBreakpoints.push(date);
    } else {
      break;
    }
  }

  if (weekBreakpoints[weekBreakpoints.length - 1] < end) {
    weekBreakpoints.push(end);
  }

  const weekBounds = weekBreakpoints.reduce((acc, day, i, source) => {
    const endBound = source[i + 1];
    if (endBound) {
      return [...acc, { start: day, end: endBound }];
    }
    return acc;
  }, []);

  return {
    start,
    end,
    weeks: weekBounds,
  };
};

const isWeekValid = (bookings, limitations) => {
  const {
    hoursPerDay,
    numberPerDay,
    numberPerWeek,
  } = limitations;

  const weekTimeDistribution = bookings.reduce((result, booking) => {
    const { start, end } = booking.attributes;
    const hours = Math.abs(end.getTime() - start.getTime()) / 3600000;
    const bookingDay = start.getDay();

    if (!result[bookingDay]) {
      return {
        ...result,
        [bookingDay]: {
          hoursTotal: hours,
          numberTotal: 1,
        }
      }
    } else {
      const dayDistribution = result[bookingDay];

      return {
        ...result,
        [bookingDay]: {
          hoursTotal: dayDistribution.hoursTotal + hours,
          numberTotal: dayDistribution.numberTotal + 1,
        },
      };
    }
  }, {});

  const isInvalidByHoursPerDay = hoursPerDay !== null
    && Object.entries(weekTimeDistribution)
      .every(([, value]) => {
        return value.hoursTotal > Number(hoursPerDay);
      });

  const isInvalidByNumberPerDay = numberPerDay !== null
    && Object.entries(weekTimeDistribution)
      .every(([, value]) => {
        return value.numberTotal > Number(numberPerDay);
      });

  const isValidByNumberPerWeek = numberPerWeek === null
    || bookings.length <= Number(numberPerWeek);

  return !isInvalidByHoursPerDay && !isInvalidByNumberPerDay && isValidByNumberPerWeek;
};

const isVisibleByAvailabilityExceptions = (listing, bookings, bounds) => {
  const limitations = listing.attributes.publicData.bookingLimitations;

  if (
    !limitations
    || Object.values(limitations).every(limitValue => !limitValue)
  ) {
    return true;
  }

  const weeksValid = bounds.weeks.map((weekBounds) => {
    const weekBookings = bookings.filter((booking) => filterBookingsInRange(booking, weekBounds));

    return weekBookings.length === 0 || isWeekValid(weekBookings, limitations);
  });

  return weeksValid.some(isValid => isValid);
};

const filterTransactionsByLimitations = (query, listingsList, sdk, integrationSdk) => {
  const bookingsQuery = listingsList.map((listing) => integrationSdk.transactions.query({
    listingId: listing.id.uuid,
    include: ['booking'],
  }).then(transactionResponse => transactionResponse.data.included));
  const bounds = getWeekBounds(query.start, query.end, true);
  const bookingsRangeFilter = (booking) => filterBookingsInRange(booking, bounds);

  return Promise.all(bookingsQuery).then((bookings) => {
    return listingsList.filter((listing, index) => {
      const bookingsInRange = bookings[index] ? bookings[index].filter(bookingsRangeFilter) : [];
      return isVisibleByAvailabilityExceptions(listing, bookingsInRange, bounds);
    });
  }).catch(e => {
    // todo: implement logging
    console.log('Error', e);
  });
};

module.exports = (req, res) => {
  const sdk = getSdk(req, res);
  const integrationSdk = getIntegrationSdk(req);

  const query = {
    ...req.body,
    ...(req.body.bounds && { bounds: transformBounds(req.body.bounds) }),
  };


  return integrationSdk.listings.query(query)
    .then(listingResponse => {
      if (query.start && query.end) {
        const listings = listingResponse.data.data;
        return filterTransactionsByLimitations(
          query,
          listings,
          sdk,
          integrationSdk,
        ).then(transactions => {
          return res
            .status(200)
            .set('Content-Type', 'application/transit+json')
            .send(
              serialize({
                ...listingResponse,
                data: {
                  ...listingResponse.data,
                  data: transactions,
                },
              }),
            )
            .end();
        });
      }

      return res
        .status(200)
        .set('Content-Type', 'application/transit+json')
        .send(
          serialize(listingResponse),
        )
        .end();
    });
};
