import React from "react";

const MatchCard = ({ result }) => {
  if (!result) return null; // no result yet

  return (
    <div className="border rounded-lg shadow-md p-6 bg-white mt-6">
      <h2 className="text-xl font-bold">Resume Match Result</h2>

      <p className="mt-2 text-lg">
        ✅ Match Score: <span className="font-semibold">{result.match}%</span>
      </p>

      <div className="mt-3">
        <h3 className="font-semibold">Matched Skills:</h3>
        {result.matched.length > 0 ? (
          <ul className="list-disc list-inside text-green-600">
            {result.matched.map((skill, idx) => (
              <li key={idx}>{skill}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No skills matched.</p>
        )}
      </div>

      <div className="mt-3">
        <h3 className="font-semibold">Missing Skills:</h3>
        {result.missing.length > 0 ? (
          <ul className="list-disc list-inside text-red-600">
            {result.missing.map((skill, idx) => (
              <li key={idx}>{skill}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No missing skills. Perfect match 🎉</p>
        )}
      </div>
    </div>
  );
};

export default MatchCard;
