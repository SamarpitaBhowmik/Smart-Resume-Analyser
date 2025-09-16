import { useEffect, useState } from "react";
import axios from "axios";

function JobList({ onSelectJob }) {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/jobs");
        setJobs(res.data);
      } catch (err) {
        console.error("Error fetching jobs:", err.message);
      }
    };
    fetchJobs();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {jobs.map((job) => (
        <div
          key={job._id}
          className="border rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition"
          onClick={() => onSelectJob(job._id)}
        >
          <h2 className="text-xl font-bold">{job.title}</h2>
          <p className="text-gray-700">{job.company} • {job.location}</p>
          <p className="text-sm text-gray-500 mt-2">
            {job.description.slice(0, 100)}...
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {job.skills.map((skill, idx) => (
              <span key={idx} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                {skill}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default JobList;
