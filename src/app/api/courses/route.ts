import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { COURSES } from "@/lib/course-data";

// GET /api/courses — list all courses (auto-seeds if empty)
export async function GET() {
  try {
    let courses = await db.course.findMany({
      where: { isPublished: true },
      include: {
        _count: { select: { lessons: true, enrollments: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Auto-seed courses if database is empty
    if (courses.length === 0) {
      for (const template of COURSES) {
        const course = await db.course.create({
          data: {
            title: template.title,
            description: template.description,
            instructor: template.instructor,
            category: template.category,
            level: template.level,
            price: template.price,
            duration: template.duration,
            isPremium: template.isPremium,
          },
        });

        for (let i = 0; i < template.lessons.length; i++) {
          const lesson = template.lessons[i];
          await db.lesson.create({
            data: {
              courseId: course.id,
              title: lesson.title,
              description: lesson.description,
              content: `Lesson content for: ${lesson.title}`,
              duration: lesson.duration,
              order: i,
              isPreview: lesson.isPreview,
            },
          });
        }
      }

      // Re-fetch after seeding
      courses = await db.course.findMany({
        where: { isPublished: true },
        include: {
          _count: { select: { lessons: true, enrollments: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    return NextResponse.json({ courses });
  } catch (e) {
    console.error("[courses] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 },
    );
  }
}
