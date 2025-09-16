import React from "react";

const JobCard = ({ job, onSelect }) => {
  return (
    <div
      className="border rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition"
      onClick={() => onSelect(job)}
    >
      <h2 className="text-xl font-semibold">{job.title}</h2>
      <p className="text-gray-600">{job.company}</p>
      <p className="text-sm text-gray-500">{job.location}</p>
    </div>
  );
};

export default JobCard;
