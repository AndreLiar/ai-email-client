// src/components/DebugUserData.tsx
// src/components/DebugUserData.tsx
'use client';

import { useUser } from "@clerk/nextjs";

export default function DebugUserData() {
  const { user } = useUser();
  
  return (
    <div className="card mt-4">
      <div className="card-header bg-light">
        <h5 className="mb-0">Debug Information</h5>
      </div>
      <div className="card-body">
        <h6>Public Metadata:</h6>
        <pre className="small p-3 bg-dark text-white rounded">
          {JSON.stringify(user?.publicMetadata, null, 2)}
        </pre>
        
        <h6 className="mt-3">User Object:</h6>
        <pre className="small p-3 bg-dark text-white rounded">
          {JSON.stringify({
            id: user?.id,
            email: user?.emailAddresses[0]?.emailAddress,
            firstName: user?.firstName,
            lastName: user?.lastName,
            createdAt: user?.createdAt
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}