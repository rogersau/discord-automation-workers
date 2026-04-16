import { useState } from "react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  if (authenticated) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <Button variant="outline" onClick={() => setAuthenticated(false)}>
          Sign out
        </Button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
              />
            </div>
            <Button className="w-full" onClick={() => setAuthenticated(password.length > 0)}>
              Sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
