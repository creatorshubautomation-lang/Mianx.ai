"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  GraduationCap,
  Clock,
  Star,
  Play,
  Check,
  Loader2,
  ArrowRight,
  Crown,
} from "lucide-react";
import { motion } from "framer-motion";

interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  category: string;
  level: string;
  price: number;
  duration: number;
  isPremium: boolean;
  rating: number;
  studentCount: number;
  _count: { lessons: number; enrollments: number };
}

const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-300",
  intermediate: "bg-amber-500/20 text-amber-300",
  advanced: "bg-red-500/20 text-red-300",
};

export function AcademyView() {
  const { setAuthModal, setView } = useApp();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/courses")
      .then((r) => r.json())
      .then((data) => {
        if (data.courses) setCourses(data.courses);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleEnroll = async (courseId: string, price: number) => {
    setEnrolling(courseId);
    try {
      const res = await fetch("/api/courses/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();

      if (data.ok) {
        toast.success("Enrolled successfully! 🎓");
      }
    } catch {
      toast.error("Failed to enroll");
    } finally {
      setEnrolling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="fixed inset-0 mesh-bg-soft -z-10" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 mb-4 text-xs">
            <GraduationCap className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-muted-foreground">{courses.length} courses</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold">
            Mianx <span className="gradient-text">Academy</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Learn to build real business apps with AI. From beginner to advanced — no coding required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {courses.map((course, i) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass border-purple-500/10 p-6 h-full flex flex-col card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex gap-1">
                    {course.isPremium && (
                      <Badge className="bg-amber-500/20 text-amber-300 text-xs">
                        <Crown className="h-3 w-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                    <Badge className={`text-xs ${LEVEL_COLORS[course.level] || LEVEL_COLORS.beginner}`}>
                      {course.level}
                    </Badge>
                  </div>
                </div>

                <h3 className="font-semibold text-lg mb-2">{course.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {course.description}
                </p>

                <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    {course._count.lessons} lessons
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {course.duration} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-400" />
                    {course.rating}
                  </span>
                  <span>{course.studentCount} students</span>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <div className="text-2xl font-bold">
                    {course.price === 0 ? (
                      <span className="text-green-400">FREE</span>
                    ) : (
                      <span>${course.price}</span>
                    )}
                  </div>
                  <Button
                    onClick={() => handleEnroll(course.id, course.price)}
                    disabled={enrolling === course.id}
                    className={course.price === 0 ? "btn-gradient text-white" : "glass"}
                    variant={course.price === 0 ? "default" : "outline"}
                    size="sm"
                  >
                    {enrolling === course.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : course.price === 0 ? (
                      <>
                        Enroll Free
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Enroll
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
