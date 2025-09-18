import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import MatchCard from "../components/MatchCard";

const JobDetails = () => {
  const { id } = useParams(); // jobId
  const [job, setJob] = useState(null);
  const [matchResult, setMatchResult] = useState(null);

  // for now: hardcode resumeId, later connect to uploaded resume
  const resumeId = "68c8eb0ba9dafcc6ed9db12c";

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/jobs/${id}`);
        setJob(res.data);
      } catch (err) {
        console.error("Error fetching job details:", err);
      }
    };
    fetchJob();
  }, [id]);

  const checkMatch = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/match", {
        resumeId,
        jobId: id,
      });
      setMatchResult(res.data);
    } catch (err) {
      console.error("Error matching resume:", err);
    }
  };

  if (!job) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6">
      <Link to="/" className="text-blue-600 underline">
        ← Back to Jobs
      </Link>

      {/* Job Details */}
      <h1 className="text-2xl font-bold mt-4">{job.title}</h1>
      <p className="text-gray-700">{job.company}</p>
      <p className="text-sm text-gray-500">{job.location}</p>

      <div className="mt-4">
        <h2 className="font-semibold">Job Description:</h2>
        <p className="mt-2">{job.description}</p>
      </div>

      {/* Skills Section */}
      {Array.isArray(job.skills) && job.skills.length > 0 && (
        <div className="mt-4">
          <h2 className="font-semibold">Required Skills:</h2>
          <ul className="list-disc list-inside text-blue-700">
            {job.skills.map((skill, idx) => (
              <li key={idx}>{String(skill)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Match Button */}
      <button
        onClick={checkMatch}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Check Resume Match
      </button>

      {/* Match Result */}
      <MatchCard result={matchResult} />
    </div>
  );
};

export default JobDetails;
