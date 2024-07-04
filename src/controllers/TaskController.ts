import type { Request, Response } from "express";
import Task from "../models/Task";

export class TaskController {
    static createTask = async (req: Request, res: Response) => {
        
        try {
            const task = new Task(req.body)
            task.project = req.project.id
            req.project.tasks.push(task.id)
            await Promise.allSettled([
                task.save(), req.project.save()
            ])
            res.send('Tarea creado correctamente')
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }

    static getProjectTasks = async (req: Request, res: Response) => {
        try {
            const tasks = await Task.find({project: req.project.id}).populate('project')
            res.json(tasks)
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }

    static getTaskById = async (req: Request, res: Response) => {
        try {
            if(req.task.project.toString() !== req.project.id){
                const error = new Error('Acción no válida')
                return res.status(400).json({error: error.message})
            }
            res.json(req.task)
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }

    static updateTask = async (req: Request, res: Response) => {
        try {
            if(req.task.project.toString() !== req.project.id){
                const error = new Error('Acción no válida')
                return res.status(400).json({error: error.message})
            }
            req.task.name = req.body.name
            req.task.description = req.body.description
            await req.task.save()
            res.send("Tarea actualizada correctamente")
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }

    static deleteTask = async (req: Request, res: Response) => {
        try {
            if(req.task.project.toString() !== req.project.id){
                const error = new Error('Acción no válida')
                return res.status(400).json({error: error.message})
            }
            req.project.tasks = req.project.tasks.filter( task => req.task._id.toString() !== req.task.id.toString() )

            await Promise.allSettled([
                req.task.deleteOne(),
                req.project.save()
            ])

            res.send("Tarea eliminada correctamente")
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }

    static updateStatus = async (req: Request, res: Response) => {
        try {
            if(req.task.project.toString() !== req.project.id){
                const error = new Error('Acción no válida')
                return res.status(400).json({error: error.message})
            }

            const{ status } = req.body
            req.task.status = status
            await req.task.save()
            res.send('Tarea Actualizada')
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
        
    }
}