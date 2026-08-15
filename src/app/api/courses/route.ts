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

    // Auto-seed courses if database is empty.
    // Race-safe: createMany + skipDuplicates relies on @@unique([title])
    // on Course and @@unique([courseId, order]) on Lesson, so concurrent
    // requests hitting an empty table can't create duplicate rows.
    if (courses.length === 0) {
      await db.course.createMany({
        data: COURSES.map((template) => ({
          title: template.title,
          description: template.description,
          instructor: template.instructor,
          category: template.category,
          level: template.level,
          price: template.price,
          duration: template.duration,
          isPremium: template.isPremium,
        })),
        skipDuplicates: true,
      });

      const seededCourses = await db.course.findMany({
        where: { title: { in: COURSES.map((c) => c.title) } },
        select: { id: true, title: true },
      });
      const idByTitle = new Map(seededCourses.map((c) => [c.title, c.id]));

      const lessonRows = COURSES.flatMap((template) => {
        const courseId = idByTitle.get(template.title);
        if (!courseId) return [];
        return template.lessons.map((lesson, i) => ({
          courseId,
          title: lesson.title,
          description: lesson.description,
          content: `Lesson content for: ${lesson.title}`,
          duration: lesson.duration,
          order: i,
          isPreview: lesson.isPreview,
        }));
      });

      if (lessonRows.length > 0) {
        await db.lesson.createMany({
          data: lessonRows,
          skipDuplicates: true,
        });
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
