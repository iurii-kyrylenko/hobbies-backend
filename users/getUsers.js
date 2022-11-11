const mongoose = require('mongoose');
const User = mongoose.model('User');

const itemsPerPage = 5;

const getPagesCount = itemsCount => {
  if (!itemsCount) return 0;
  const int = Math.floor(itemsCount / itemsPerPage);
  const mod = itemsCount % itemsPerPage;
  return mod ? int + 1 : int;
};

const filterConditions = term => {
  const expr = { $or: [{ shareBooks: true }, { shareMovies: true }] };
  return term ? { $and: [expr, { name: new RegExp(term, 'i') }] } : expr;
};

const getAggregator = match => User.aggregate()
  .match(match)
  .lookup({ from: "books", localField: "_id", foreignField: "userId", as: "books" })
  .lookup({ from: "movies", localField: "_id", foreignField: "userId", as: "movies" })
  .project({
    name: 1,
    shareBooks: 1,
    shareMovies: 1,
    books: { $size: "$books" },
    movies: { $size: "$movies" },
    total: { $add: [{ $size: '$books' }, { $size: '$movies' }] }
  })
  .match({ total: { $gt: 0 } });

const fetchUsers = async (term, page) => {
  const match = filterConditions(term);

  const aggregator = getAggregator(match)
    .sort({ total: -1, name: 1 });

  // This doesn't work in mongoose:
  // getAggregator(match).count("count");
  const aggregatorCount = getAggregator(match)
    .append({ $count: "count" });

  const [{ count }] = await aggregatorCount;

  const pages = getPagesCount(count);

  if (page > 0) {
    const itemsToSkip = itemsPerPage * (page - 1);
    aggregator.skip(itemsToSkip).limit(itemsPerPage);
  }

  const items = await aggregator;

  return { items, pages };
};

const getUsers = async ({ query: { term, page } }, res) => {
  try {
    const result = await fetchUsers(term, page);
    res.send(result);
  }
  catch (err) {
    res.status(400).json(err);
  }
};

module.exports = { getUsers };
