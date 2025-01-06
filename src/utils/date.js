function getDate() {
  //Date
  const date = new Date().getDate();
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  //Time
  const hour = new Date().getHours();
  var minute = new Date().getMinutes();
  minute < 10 ? (minute = "" + minute) : (minute = minute);
  var dayTime = hour >= 12 ? "PM" : "AM";

  const fullDate = `${year}${month.length > 1 ? month : `0${month}`}${
    date.length > 1 ? date : `0${date}`
  }`;
  return fullDate.toString();
}

module.exports = {
  getDate,
};
