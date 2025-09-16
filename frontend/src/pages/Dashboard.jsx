import React, { useEffect, useState } from "react";
import axios from "axios";
import JobCard from "../components/JobCard";

const Dashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/jobs");
        setJobs(res.data);
      } catch (err) {
        console.error("Error fetching jobs:", err);
      }
    };
    fetchJobs();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Available Jobs</h1>

      {/* Job Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs.map((job) => (
          <JobCard key={job._id} job={job} onSelect={setSelectedJob} />
        ))}
      </div>

      {/* Selected Job Details */}
      {selectedJob && (
        <div className="mt-6 border rounded-lg p-4 bg-gray-100">
          <h2 className="text-xl font-bold">{selectedJob.title}</h2>
          <p className="text-gray-700">{selectedJob.company}</p>
          <p className="text-sm text-gray-500">{selectedJob.location}</p>
          <p className="mt-3">{selectedJob.description}</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
