"use client";

import React, { useState, useEffect } from "react";
import { db, initAnalytics } from "@/lib/firebase";
import {
  User,
  Mail,
  Lock,
  Package,
  Search,
  LogOut,
  X,
  MapPin,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useUser, useSignIn, useSignUp, useClerk } from "@clerk/nextjs";

interface Parcel {
  id: string;
  company: string;
  description: string;
  status: string;
  pin: string;
  qrData: string;     // ✅ ADD THIS
  location: string;
  date: string;
}


export default function UniDropApp() {
  const { user, isLoaded: userLoaded } = useUser();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { signOut: clerkSignOut } = useClerk();
  
  const [activeAuthTab, setActiveAuthTab] = useState<"signup" | "login">("login");
  const [activeTab, setActiveTab] = useState<"toCollect" | "collected">("toCollect");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    username: "",
    password: "",
  });
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [userUniDropId, setUserUniDropId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const isLoggedIn = !!user;

  // ------------------- Client-side Analytics -------------------
  useEffect(() => {
    initAnalytics().then((analytics) => {
      if (analytics) console.log("Analytics initialized:", analytics);
    });
  }, []);

  // ------------------- Auth State Persistence -------------------
  useEffect(() => {
    if (!userLoaded) return;

    if (user) {
      // Fetch user info from Firestore
      const fetchUserData = async () => {
        try {
          const userRef = doc(db, "users", user.id);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setFormData((prev) => ({
              ...prev,
              fullName: userData.fullName || user.firstName || user.fullName || "",
              username: userData.username || user.username || "",
              email: userData.email || user.primaryEmailAddress?.emailAddress || "",
            }));
            setUserUniDropId(userData.unidropId || "");
            fetchParcels(userData.unidropId || "");
          } else {
            // Create user document if it doesn't exist
            const unidropId = await generateUniDropId();
            await setDoc(doc(db, "users", user.id), {
              fullName: user.firstName || user.fullName || "",
              username: user.username || "",
              email: user.primaryEmailAddress?.emailAddress || "",
              unidropId,
              createdAt: new Date(),
            });
            setUserUniDropId(unidropId);
            setFormData((prev) => ({
              ...prev,
              fullName: user.firstName || user.fullName || "",
              username: user.username || "",
              email: user.primaryEmailAddress?.emailAddress || "",
            }));
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      };

      fetchUserData();
    }
  }, [user, userLoaded]);

  // ------------------- Generate Unique UniDrop ID -------------------
  const generateUniDropId = async (): Promise<string> => {
    const generateRandomId = () => {
      const randomNum = Math.floor(Math.random() * 90000) + 10000;
      return `UD${randomNum}`;
    };

    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      const candidateId = generateRandomId();
      
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("unidropId", "==", candidateId));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return candidateId;
      }

      attempts++;
    }

    const timestamp = Date.now().toString().slice(-5);
    return `UD${timestamp}`;
  };


  // ------------------- Form Handlers -------------------
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setEmailSent(false); // Reset email sent state when user changes input
  };

  const handleSubmit = async () => {
    if (!signInLoaded || !signUpLoaded) {
      setError("Authentication system is loading. Please wait...");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      if (!formData.email.endsWith("@gmail.com")) {
        setError("Please use a Gmail address to register or login.");
        setIsLoading(false);
        return;
      }

      if (activeAuthTab === "signup") {
        if (!signUp) {
          setError("Sign up is not available. Please try again.");
          setIsLoading(false);
          return;
        }

        // Validate required fields
        if (!formData.fullName.trim() || !formData.email.trim() || !formData.password.trim()) {
          setError("Please fill in all required fields.");
          setIsLoading(false);
          return;
        }

        // Create user with Clerk
        const result = await signUp.create({
          emailAddress: formData.email,
          password: formData.password,
          firstName: formData.fullName.split(" ")[0] || formData.fullName,
          lastName: formData.fullName.split(" ").slice(1).join(" ") || "",
          username: formData.username || undefined, // Make username optional
        });

        // Handle different sign-up statuses
        if (result.status === "complete") {
          // User is created and signed in automatically
          // User data will be fetched in useEffect
        } else if (result.status === "missing_requirements") {
          // Email verification required
          try {
            // Get the current URL for redirect after email verification
            const redirectUrl = typeof window !== "undefined" 
              ? `${window.location.origin}${window.location.pathname}`
              : "/";
            
            // Try email_link first (requires Clerk dashboard configuration)
            try {
              await signUp.prepareEmailAddressVerification({ 
                strategy: "email_link",
                redirectUrl: redirectUrl
              });
              setEmailSent(true);
              setError(""); // Clear any previous errors
            } catch (linkErr: any) {
              // If email_link is not available, fall back to email_code
              console.log("Email link not available, using email code:", linkErr);
              await signUp.prepareEmailAddressVerification({ 
                strategy: "email_code"
              });
              // For email code, we need to show a code input (not just a message)
              setError("Please check your email for a verification code. You'll need to enter it to complete registration.");
              setEmailSent(false);
            }
          } catch (verifyErr: any) {
            console.error("Verification error:", verifyErr);
            const errorMsg = verifyErr?.errors?.[0]?.message || verifyErr?.message || "Unknown error";
            if (errorMsg.includes("email_link") || errorMsg.includes("not match")) {
              setError("Email link verification is not enabled in your Clerk dashboard. Please enable it in Clerk Dashboard → Email Address settings, or the app will use email codes instead.");
            } else {
              setError("Failed to send verification email. Please try again.");
            }
            setEmailSent(false);
          }
        } else {
          setError("Registration incomplete. Please try again.");
          setEmailSent(false);
        }
      } else {
        // Login flow
        if (!signIn) {
          setError("Sign in is not available. Please try again.");
          setIsLoading(false);
          return;
        }

        if (!formData.email.trim() || !formData.password.trim()) {
          setError("Please enter your email and password.");
          setIsLoading(false);
          return;
        }

        // Sign in with Clerk
        const result = await signIn.create({
          identifier: formData.email,
          password: formData.password,
        });

        if (result.status === "complete") {
          // User is signed in
          // User data will be fetched in useEffect
        } else if (result.status === "needs_first_factor") {
          setError("Additional verification required. Please check your email.");
        } else {
          setError("Sign in failed. Please check your credentials.");
        }
      }
    } catch (err: unknown) {
      console.error("Auth error:", err);
      
      // Handle specific Clerk errors
      if (err && typeof err === "object" && "errors" in err) {
        const clerkError = err as { errors: Array<{ message: string; code?: string }> };
        const errorMessage = clerkError.errors?.[0]?.message || "Authentication failed";
        
        // Provide user-friendly error messages
        if (errorMessage.includes("Couldn't find your account") || errorMessage.includes("not found")) {
          setError("Account not found. Please check your email or sign up for a new account.");
        } else if (errorMessage.includes("password") || errorMessage.includes("incorrect")) {
          setError("Incorrect email or password. Please try again.");
        } else if (errorMessage.includes("already exists") || errorMessage.includes("taken")) {
          setError("An account with this email already exists. Please sign in instead.");
        } else {
          setError(errorMessage);
        }
      } else if (err instanceof Error) {
        // Handle standard Error objects
        const errorMsg = err.message;
        if (errorMsg.includes("Couldn't find your account") || errorMsg.includes("not found")) {
          setError("Account not found. Please check your email or sign up for a new account.");
        } else if (errorMsg.includes("password") || errorMsg.includes("incorrect")) {
          setError("Incorrect email or password. Please try again.");
        } else {
          setError(errorMsg);
        }
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await clerkSignOut();
      setFormData({ fullName: "", email: "", username: "", password: "" });
      setUserUniDropId("");
      setParcels([]);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

const fetchParcels = async (unidropId: string) => {
  try {
    const q = query(
      collection(db, "parcels"),
      where("trackingNumber", "==", unidropId)
    );

    const snapshot = await getDocs(q);

    const list: Parcel[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();

      const dateOnly =
        typeof data.date === "string"
          ? data.date.split(",")[0].trim()
          : "Unknown date";

      return {
        id: docSnap.id,
        company: dateOnly,
        description: "",
        status: data.status || "Unknown",
        pin: data.pin || "",
        qrData: data.qrData || "",      // ✅ ADD THIS
        location: "UniDrop Collection Counter",
        date: dateOnly,
      };

    });

    setParcels(list);
  } catch (err) {
    console.error("Error fetching parcels:", err);
  }
};


  const handleShowCode = (parcel: Parcel) => setSelectedParcel(parcel);
  const handleCloseModal = () => setSelectedParcel(null);

  // Show loading state while Clerk is initializing
  if (!userLoaded || !signInLoaded || !signUpLoaded) {
    return (
      <div className="h-screen overflow-hidden bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
            <Package className="w-10 h-10 text-purple-600" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">UniDrop</h1>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if Clerk is configured (client-side only)
  const isClerkConfigured = typeof window !== "undefined" && 
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // Show configuration error if Clerk is not set up (only show if we're past loading)
  if (!isClerkConfigured && userLoaded) {
    return (
      <div className="h-screen overflow-hidden bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-red-900 mb-2">Configuration Required</h2>
            <p className="text-red-700 text-sm mb-4">
              Clerk authentication is not configured. Please set up your environment variables.
            </p>
            <p className="text-red-600 text-xs mb-2">
              Create a <code className="bg-red-100 px-2 py-1 rounded">.env.local</code> file with:
            </p>
            <p className="text-red-500 text-xs font-mono bg-red-100 p-2 rounded mb-2">
              NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
            </p>
            <p className="text-red-500 text-xs mt-2">
              See CLERK_SETUP.md for detailed instructions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ------------------- Login / Signup -------------------
  if (!isLoggedIn) {
    return (
      <div className="h-screen overflow-hidden bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
              <Package className="w-10 h-10 text-purple-600" strokeWidth={1.5} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">UniDrop</h1>
            <p className="text-gray-500 text-sm">Your parcel collection companion</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl overflow-hidden p-5">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => {
                  setActiveAuthTab("login");
                  setEmailSent(false);
                }}
                className={`flex-1 pb-2 text-center font-semibold transition-all text-lg ${
                  activeAuthTab === "login"
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-400 border-b-2 border-transparent"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => {
                  setActiveAuthTab("signup");
                  setEmailSent(false);
                }}
                className={`flex-1 pb-2 text-center font-semibold transition-all text-lg ${
                  activeAuthTab === "signup"
                    ? "text-gray-900 border-b-2 border-gray-900"
                    : "text-gray-400 border-b-2 border-transparent"
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            {emailSent && activeAuthTab === "signup" && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-green-900 font-semibold text-sm mb-1">Verification Email Sent!</h3>
                    <p className="text-green-700 text-sm mb-2">
                      We've sent a verification link to <strong>{formData.email}</strong>
                    </p>
                    <p className="text-green-600 text-xs">
                      Please check your email and click the link to verify your account. After verification, you can sign in.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="relative overflow-hidden">
              <div
                className="transition-transform duration-500 ease-in-out"
                style={{
                  transform: activeAuthTab === "login" ? "translateX(0)" : "translateX(-100%)",
                }}
              >
                <div className="flex">
                  {/* Login Form */}
                  <div className="w-full flex-shrink-0 space-y-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Email address"
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-900 text-sm focus:outline-none focus:border-purple-500 transition-all"
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Password"
                        className="w-full pl-12 pr-12 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-900 text-sm focus:outline-none focus:border-purple-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className="w-full mt-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-colors text-sm shadow-lg"
                    >
                      {isLoading ? "Signing in..." : "Welcome Back"}
                    </button>

                    <p className="text-center text-gray-600 text-xs mt-4">
                      Don't have an account?{" "}
                      <button
                        onClick={() => {
                          setActiveAuthTab("signup");
                          setEmailSent(false);
                        }}
                        className="text-purple-600 font-semibold"
                      >
                        Switch to Register
                      </button>
                    </p>
                  </div>

                  {/* Signup Form */}
                  <div className="w-full flex-shrink-0 space-y-3 pl-6">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        placeholder="Full Name"
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-900 text-sm focus:outline-none focus:border-purple-500 transition-all"
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Email address"
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-900 text-sm focus:outline-none focus:border-purple-500 transition-all"
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="Username"
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-900 text-sm focus:outline-none focus:border-purple-500 transition-all"
                      />
                    </div>

                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Password"
                        className="w-full pl-12 pr-12 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-gray-900 text-sm focus:outline-none focus:border-purple-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className="w-full mt-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-colors text-sm shadow-lg"
                    >
                      {isLoading ? "Creating account..." : "Create Account"}
                    </button>

                    <p className="text-center text-gray-600 text-xs mt-3">
                      Already have an account?{" "}
                      <button
                        onClick={() => {
                          setActiveAuthTab("login");
                          setEmailSent(false);
                        }}
                        className="text-purple-600 font-semibold"
                      >
                        Switch to Login
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-4 text-gray-500 text-xs flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Your data is stored securely</span>
          </div>
        </div>
      </div>
    );
  }

  // ------------------- Dashboard -------------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 pt-8">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 sticky top-0 z-10 mt-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-md">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-gray-900 font-bold text-lg">UniDrop</h1>
              <p className="text-gray-500 text-xs">
                Hi, {formData.fullName || user?.firstName || user?.fullName || "User"}
              </p>
              {userUniDropId && (
                <p className="text-purple-600 text-xs font-semibold">
                  ID: {userUniDropId}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search parcels..."
            className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:bg-white focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pt-8">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1 font-medium">Ready for Pickup</p>
              <h2 className="text-white text-3xl font-bold mb-1">{parcels.length}</h2>
              <p className="text-purple-100 text-xs">
                {parcels.length === 1 ? "parcel" : "parcels"} waiting
              </p>
            </div>
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Package className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setActiveTab("toCollect")}
            className={`flex-1 py-3.5 rounded-xl font-semibold transition-all text-sm shadow-sm ${
              activeTab === "toCollect"
                ? "bg-purple-600 text-white shadow-purple-200"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            To Collect
          </button>
          <button
            onClick={() => setActiveTab("collected")}
            className={`flex-1 py-3.5 rounded-xl font-semibold transition-all text-sm shadow-sm ${
              activeTab === "collected"
                ? "bg-purple-600 text-white shadow-purple-200"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Collected
          </button>
        </div>

        {/* Parcel List */}
        {activeTab === "toCollect" ? (
          <div className="space-y-4 pb-8">
            {parcels.length > 0 ? (
              parcels.map((parcel) => (
                <div
                  key={parcel.id}
                  className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      {parcel.status}
                    </div>
                    <span className="text-gray-400 text-xs font-medium">{parcel.id}</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{parcel.company}</h3>
                  <p className="text-gray-500 text-sm mb-4 leading-relaxed">
                    {parcel.description}
                  </p>
                  <button
                    onClick={() => handleShowCode(parcel)}
                    className="w-full bg-gradient-to-r from-black to-black hover:from-black hover:to-black text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md shadow-black"
                  >
                    <Package className="w-4 h-4" />
                    Show Collection Code
                  </button>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-10 text-center border border-gray-100">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Parcels Yet</h3>
                <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                  Your parcels will appear here when they're ready for collection
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            <div className="bg-white rounded-2xl shadow-sm p-10 text-center border border-gray-100">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Collected Parcels</h3>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto">
                Parcels you've collected will be shown here
              </p>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {selectedParcel && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden relative">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-center relative">
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-bold text-white mb-1">{selectedParcel.company}</h2>
              <p className="text-purple-100 text-sm">{selectedParcel.id}</p>
            </div>
            <div className="p-6">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-2xl p-6 mb-5 flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    selectedParcel.qrData
                  )}&color=8b5cf6`}
                  alt="QR Code"
                  className="w-full h-auto max-w-xs"
                />
              </div>
              <p className="text-gray-500 text-center text-sm mb-5 font-medium">
                Scan this code at the collection terminal
              </p>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-2xl p-5 mb-5">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Lock className="w-5 h-5 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
                    PIN Code
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold text-gray-900 tracking-wider">
                    {selectedParcel.pin}
                  </span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 flex items-start gap-3 border border-gray-200">
                <MapPin className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">
                    Collection Point
                  </p>
                  <p className="text-gray-900 font-medium text-sm leading-relaxed">
                    {selectedParcel.location}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}